import MonitorSettingsService from './monitor-settings.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import jwtDecode from "jwt-decode";
import fetch from "node-fetch";
import { Utils } from './utils.service'
import peach from 'parallel-each'

const ONE_DAY_IN_MS = 86400000;

const errors = {
    "DAILY-ADDON-USAGE-LIMIT-REACHED": { "Message": 'Distributor passed the daily addon usage limit', "Color": "FF0000" },
    "MONTHLY-ADDON-USAGE-LIMIT-REACHED": { "Message": 'Distributor passed the monthly addon usage limit', "Color": "FF0000" },
    "UNKNOWN-ERROR": { "Message": 'Unknown error occured, contact rnd to fix this', "Color": "990000" },
};

export async function daily_addon_usage(client: Client, request: Request) {
    console.log('HealthMonitorAddon start daily addon usage');
    const monitorSettingsService = new MonitorSettingsService(client);
    const distributor = await monitorSettingsService.papiClient.get('/distributor');

    try {
        const monitorSettings = await updateMonitorSettings(monitorSettingsService);
        const dailyAddonsUsage = await getDailyAddonUsage(monitorSettingsService, distributor, monitorSettings);
        const checkMaintenance = await checkMaintenanceWindow(monitorSettingsService, monitorSettings);

        return {
            success: true,
            resultObject: dailyAddonsUsage
        };
    }
    catch (error) {
        const innerMessage = Utils.GetErrorDetailsSafe(error);
        console.log(`HealthMonitorAddon daily addon usage failed with err: ${innerMessage}`);
        reportError(monitorSettingsService, distributor, 'ADDON-USAGE', 'UNKNOWN-ERROR', innerMessage);

        return {
            success: false,
            errorMessage: innerMessage,
        }
    }
};

export async function getCloudWatchLogs(service, distributorUUID: string) {

    const statsForSyncAddons = getQueryParameters(distributorUUID, ["Addon"])
    const statsForAsyncAddons = getQueryParameters(distributorUUID, ["AsyncAddon"])

    const addonsUsage = {}
    let results: any[] = []

    // parallel foreach
    await peach([statsForSyncAddons, statsForAsyncAddons], async (value: object) => {
        results = results.concat(await service.papiClient.post(`/logs`, value), results)
    }, 2)

    results.forEach(result => {
        addonsUsage[result.AddonUUID.toLowerCase()] = {
            Count:
                addonsUsage[result.AddonUUID.toLowerCase()] ?
                    addonsUsage[result.AddonUUID.toLowerCase()].Count + Number(result.Count) :
                    Number(result.Count),
            Duration:
                addonsUsage[result.AddonUUID.toLowerCase()] ?
                    addonsUsage[result.AddonUUID.toLowerCase()].Duration + Number(result.TotalDuration) :
                    Number(result.TotalDuration),
            MemoryUsage:
                addonsUsage[result.AddonUUID.toLowerCase()] ?
                    addonsUsage[result.AddonUUID.toLowerCase()].MemoryUsage + Number(result.MemoryUsage) :
                    Number(result.MemoryUsage),
        };
    });

    return addonsUsage;
}

//#region private methods

async function getDailyAddonUsage(monitorSettingsService, distributor, monitorSettings) {
    const now = Date.now();

    // get the daily memory usage per addon from CloudWatch
    const cloudWatchLogs = await getCloudWatchLogs(monitorSettingsService, distributor.UUID);
    const dailyAddonUsage = await upsertDailyAddonUsageToADAL(monitorSettingsService, cloudWatchLogs, now);

    // check conditions for problematic use of lambdas, create report and alert problems
    const memoryUsageLimit = monitorSettings.MemoryUsageLimit;
    const dailyReport = await getDailyReport(monitorSettingsService, distributor, dailyAddonUsage, memoryUsageLimit);
    const monthlyReport = await getMonthlyReport(monitorSettingsService, distributor, memoryUsageLimit);

    console.log('HealthMonitorAddon ended daily addon usage');
    return { DailyPassedLimit: dailyReport["PassedLimit"], MonthlyPassedLimit: monthlyReport["PassedLimit"] };
}

function getQueryParameters(distributorUUID, logGroups: string[]) {
    const timeStamp = Date.now()
    return {
        Groups: logGroups,
        PageSize: 10000,
        Stats: "count(*) as Count, sum(Duration) as TotalDuration, sum(Duration)*LambdaMemorySize as MemoryUsage by AddonUUID,LambdaMemorySize",
        Filter: 'Duration > 0' + ' and ' + `DistributorUUID='${distributorUUID}'`,
        DateTimeStamp: { 
            // Looking at data from one calendar day of yesterday
            Start: new Date(new Date(timeStamp - ONE_DAY_IN_MS).setUTCHours(0, 0, 0, 0)).toISOString(),
            End: new Date(new Date(timeStamp - ONE_DAY_IN_MS).setUTCHours(23, 59, 59, 999)).toISOString()
        }
    };
}

async function upsertDailyAddonUsageToADAL(monitorSettingsService, cloudWatchLogs, now) {
    const nowDate = new Date(now - ONE_DAY_IN_MS);
    const dailyAddonUsageBody = {
        Key: nowDate.toLocaleDateString(),
        AddonsUsage: cloudWatchLogs,
        ExpirationDateTime: getExpirationDateTime()
    };

    const dailyAddonUsageResponse = await monitorSettingsService.papiClient.addons.data.uuid(monitorSettingsService.clientData.addonUUID).table('DailyAddonUsage').upsert(dailyAddonUsageBody);
    return dailyAddonUsageResponse;
}

async function getDailyReport(service, distributor, dailyAddonUsage, memoryUsageLimit) {
    const dailyReport = { PassedLimit: new Array(), NotPassedLimit: new Array() };

    if (dailyAddonUsage != null && dailyAddonUsage.AddonsUsage != null && Object.keys(dailyAddonUsage.AddonsUsage).length > 0) {
        const addonsUsage = dailyAddonUsage.AddonsUsage;
        for (var item in addonsUsage) {
            if (addonsUsage[item].MemoryUsage != null && addonsUsage[item].MemoryUsage > memoryUsageLimit) {
                const innerMessage = "AddonUUID " + item + " reached the memory usage limit - " + addonsUsage[item].MemoryUsage;
                await reportError(service, distributor, "ADDON-USAGE", "DAILY-ADDON-USAGE-LIMIT-REACHED", innerMessage);
                dailyReport["PassedLimit"].push(item);
            }
            else if (addonsUsage[item].MemoryUsage != null && addonsUsage[item].MemoryUsage < memoryUsageLimit) {
                dailyReport["NotPassedLimit"].push(item);
            }
        }
    }

    return dailyReport;
}

async function getMonthlyReport(service, distributor, memoryUsageLimit) {
    const monthlyReport = { PassedLimit: new Array(), NotPassedLimit: new Array() };
    const monthlyAddonUsageResponse = await service.papiClient.addons.data.uuid(service.clientData.addonUUID).table('DailyAddonUsage').iter({ order_by: "CreationDateTime desc", page_size: 30 }).toArray();
    const monthlyAddonUsage = new Array();
    let addonsUsage = {};

    monthlyAddonUsageResponse.forEach(dailyAddonsUsage => {
        addonsUsage = dailyAddonsUsage.AddonsUsage;
        for (var item in addonsUsage) {
            monthlyAddonUsage[item] = {
                Count: monthlyAddonUsage[item] ? monthlyAddonUsage[item].Count + addonsUsage[item].Count : addonsUsage[item].Count,
                Duration: monthlyAddonUsage[item] ? monthlyAddonUsage[item].Duration + addonsUsage[item].Duration : addonsUsage[item].Duration,
                MemoryUsage: monthlyAddonUsage[item] ? monthlyAddonUsage[item].MemoryUsage + addonsUsage[item].MemoryUsage : addonsUsage[item].MemoryUsage
            };
        }
    });

    if (monthlyAddonUsage != null && Object.keys(monthlyAddonUsage).length > 0) {
        for (var item in monthlyAddonUsage) {
            if (monthlyAddonUsage[item].MemoryUsage != null && monthlyAddonUsage[item].MemoryUsage > (memoryUsageLimit * 10)) {
                const innerMessage = "AddonUUID " + item + " reached the memory usage limit - " + monthlyAddonUsage[item].MemoryUsage;
                reportError(service, distributor, "ADDON-USAGE", "MONTHLY-ADDON-USAGE-LIMIT-REACHED", innerMessage);
                monthlyReport["PassedLimit"].push(item);
            }
            else if (monthlyAddonUsage[item].MemoryUsage != null && monthlyAddonUsage[item].MemoryUsage < (memoryUsageLimit * 10)) {
                monthlyReport["NotPassedLimit"].push(item);
            }
        }
    }

    return monthlyReport;
}

function getExpirationDateTime() {
    // the ExpirationDateTime is 2 years
    let expirationDateTime = new Date(Date.now());
    expirationDateTime.setFullYear(expirationDateTime.getFullYear() + 2);
    return expirationDateTime.toISOString();
}

async function reportError(service, distributor, errorCode, type, innerMessage) {
    const environmant = jwtDecode(service.clientData.OAuthAccessToken)["pepperi.datacenter"];
    // report error to cloud watch
    let error = 'DistributorID: ' + distributor.InternalID + '\n\rName: ' + distributor.Name + '\n\rType: ' + type + '\n\rCode: ' + errorCode + '\n\rMessage: ' + errors[type]["Message"] + '\n\rInnerMessage: ' + innerMessage;
    console.error(error);

    // report error to teams on System Status chanel
    let url;
    const body = {
        themeColor: errors[type]["Color"],
        Summary: distributor.InternalID + " - " + distributor.Name,
        sections: [{
            facts: [{
                name: "Distributor ID",
                value: distributor.InternalID
            }, {
                name: "Name",
                value: distributor.Name
            }, {
                name: "Code",
                value: errorCode
            }, {
                name: "Type",
                value: type
            }, {
                name: "Message",
                value: errors[type]["Message"]
            }, {
                name: "Inner Message",
                value: innerMessage
            }],
            "markdown": true
        }]
    }

    if (environmant == 'sandbox') {
        url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/e5f4ab775d0147ecbb7f0f6bdf70aa0b/4361420b-8fde-48eb-b62a-0e34fec63f5c';
    }
    else {
        url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/0db0e56f12044634937712db79f704e1/4361420b-8fde-48eb-b62a-0e34fec63f5c';
    }

    var res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body)
    });
}

async function checkMaintenanceWindow(service, monitorSettings) {
    let success = false;

    try {
        const maintenance = await service.papiClient.metaData.flags.name('Maintenance').get();
        const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);
        const seconds = monitorSettings.SyncFailed.Interval / 1000;
        const minutes = seconds / 60;
        const hours = minutes / 60;
        let updatedCronExpression;

        if (hours > 1) {
            updatedCronExpression = await getCronExpression(service.clientData.OAuthAccessToken, maintenanceWindowHour, false, true, hours);
        }
        else {
            updatedCronExpression = await getCronExpression(service.clientData.OAuthAccessToken, maintenanceWindowHour, true, false, minutes);
        }

        const codeJob = await service.papiClient.get('/code_jobs/' + monitorSettings.SyncFailedCodeJobUUID);
        const previosCronExpression = codeJob.CronExpression;
        if (updatedCronExpression != previosCronExpression) {
            await updateCodeJobCronExpression(service.papiClient, codeJob, updatedCronExpression);
        }
        success = true;
        return success;
    }
    catch (_) {
        return success;
    }
}

async function updateMonitorSettings(service) {
    let distributorData = await service.papiClient.get('/distributor');
    const machineData = await service.papiClient.get('/distributor/machine');
    const monitorLevel = (await service.getMonitorSettings()).monitorLevel


    let monitorSettings = await service.getMonitorSettings();
    monitorSettings.Name = distributorData.Name;
    monitorSettings.MachineAndPort = machineData.Machine + ":" + machineData.Port;
    monitorSettings.MonitorLevel = monitorLevel;

    const response = await service.setMonitorSettings(monitorSettings);
    return response;
}

async function getCronExpression(token, maintenanceWindowHour, minutes = true, hours = false, interval = 5, dailyTime = 6) {
    let minute;
    let hour;

    if (minutes) {
        // rand is integet between 0-{value-1} included.
        const rand = (jwtDecode(token)['pepperi.distributorid']) % interval;
        minute = rand + "-59/" + interval;
        switch (maintenanceWindowHour) {
            case 0:
                hour = "2-22";
                break;
            case 1:
                hour = "3-23";
                break;
            case 2:
                hour = "0,4-23";
                break;
            case 21:
                hour = "0-19,23";
                break;
            case 22:
                hour = "0-20";
                break;
            case 23:
                hour = "1-21";
                break;
            default:
                hour = "0-" + (maintenanceWindowHour - 2) + ',' + (maintenanceWindowHour + 2) + "-23";
        }
    }
    else if (hours) {
        // rand is integet between 0-59 included.
        const rand = (jwtDecode(token)['pepperi.distributorid']) % 60;
        minute = rand + "-59/60";

        let i = dailyTime;
        while (i >= interval) {
            i = i - interval;
        }

        hour = i.toString();
        i = i + interval;
        while (i < 24) {
            hour = hour + "," + i;
            i = i + interval;
        }
    }
    return minute + " " + hour + " * * *";
}

async function updateCodeJobCronExpression(papiClient, codeJob, updatedCronExpression) {
    const response = await papiClient.codeJobs.upsert({
        UUID: codeJob.UUID,
        CronExpression: updatedCronExpression,
        IsScheduled: true
    });

    return response;
}

//#endregion