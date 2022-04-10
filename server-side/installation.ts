
/*
The return object format MUST contain the field 'success':
{success:true}

If the result of your code is 'false' then return:
{success:false, errorMessage:{the reason why it is false}}
The erroeMessage is importent! it will be written in the audit log and help the user to understand what happen
*/
import { AddonDataScheme, Relation } from "@pepperi-addons/papi-sdk";
import { Utils } from './utils.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import jwtDecode from "jwt-decode";
import MonitorSettingsService from './monitor-settings.service';
import VarRelationService from "./relations.var.service";

const DEFAULT_MEMORY_USAGE = 5000000

exports.install = async (client: Client, request: Request) => {
    try {
        let success = true;
        let errorMessage = '';
        let resultObject = {};
        let successSyncFailed = true;
        let successJobLimitReached = true;
        let successJobExecutionFailed = true;
        let successDailyAddonUsage = true;
        let successUsageMonitor = true;

        const defaultMonitorValue = 4;
        const monitorSettingsService = new MonitorSettingsService(client);
        const relationVarSettingsService = new VarRelationService(client);

        const bodyADAL1: AddonDataScheme = {
            Name: 'HealthMonitorSettings',
            Type: 'meta_data'
        };
        const headersADAL1 = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        };

        const responseSettingsTable1 = await monitorSettingsService.papiClient.post('/addons/data/schemes', bodyADAL1, headersADAL1);

        // install SyncFailed test
        let retValSyncFailed = await InstallSyncFailed(monitorSettingsService);
        successSyncFailed = retValSyncFailed.success;
        errorMessage = "SyncFailed Test installation failed on: " + retValSyncFailed.errorMessage;
        if (!successSyncFailed) {
            console.error(errorMessage);
            return retValSyncFailed;
        }
        console.log('SyncFailed codejob installed succeeded.');

        // install JobLimitReached test
        let retValJobLimitReached = await InstallJobLimitReached(monitorSettingsService);
        successJobLimitReached = retValJobLimitReached.success;
        errorMessage = "JobLimitReached Test installation failed on: " + retValJobLimitReached.errorMessage;
        if (!successJobLimitReached) {
            console.error(errorMessage);
            return retValJobLimitReached;
        }
        console.log('JobLimitReached codejob installed succeeded.');

        // install JobExecutionFailed test
        let retValJobExecutionFailed = await InstallJobExecutionFailed(monitorSettingsService);
        successJobExecutionFailed = retValJobExecutionFailed.success;
        errorMessage = "JobExecutionFailed Test installation failed on: " + retValJobExecutionFailed.errorMessage;
        if (!successJobExecutionFailed) {
            console.error(errorMessage);
            return retValJobExecutionFailed;
        }
        console.log('JobExecutionFailed codejob installed succeeded.');

        // install DailyAddonUsage codejob
        let retValDailyAddonUsage = await InstallDailyAddonUsage(monitorSettingsService);
        successDailyAddonUsage = retValDailyAddonUsage.success;
        errorMessage = "DailyAddonUsage codejob installation failed on: " + retValDailyAddonUsage.errorMessage;
        if (!successDailyAddonUsage) {
            console.error(errorMessage);
            return retValDailyAddonUsage;
        }
        console.log('DailyAddonUsage codejob installed succeeded.');

        // from 2.1 addon settings on ADAL
        const bodyADAL: AddonDataScheme = {
            Name: 'HealthMonitorSettings',
            Type: 'meta_data'
        };
        const headersADAL = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        };

        const responseSettingsTable = await monitorSettingsService.papiClient.post('/addons/data/schemes', bodyADAL, headersADAL);

        const data = {};
        const distributor = await GetDistributor(monitorSettingsService.papiClient);
        const currentMemoryUsageLimit = (await monitorSettingsService.getMonitorSettings()).MemoryUsageLimit

        data["Name"] = distributor.Name;
        data["MachineAndPort"] = distributor.MachineAndPort;
        data["MonitorLevel"] = defaultMonitorValue;
        data["MemoryUsageLimit"] = (currentMemoryUsageLimit === undefined) ? DEFAULT_MEMORY_USAGE : currentMemoryUsageLimit;
        data["SyncFailed"] = { Type: "Sync failed", Status: true, ErrorCounter: 0, MapDataID: retValSyncFailed["mapDataID"], Email: "", Webhook: "", Interval: parseInt(retValSyncFailed["interval"]) * 60 * 1000 };
        data["JobLimitReached"] = { Type: "Job limit reached", LastPercantage: 0, Email: "", Webhook: "", Interval: 24 * 60 * 60 * 1000 };
        data["JobExecutionFailed"] = { Type: "Job execution failed", Email: "", Webhook: "", Interval: 24 * 60 * 60 * 1000 };
        data[retValSyncFailed["codeJobName"]] = retValSyncFailed["codeJobUUID"];
        data[retValJobLimitReached["codeJobName"]] = retValJobLimitReached["codeJobUUID"];
        data[retValJobExecutionFailed["codeJobName"]] = retValJobExecutionFailed["codeJobUUID"];
        data[retValDailyAddonUsage["codeJobName"]] = retValDailyAddonUsage["codeJobUUID"];
        //data[retValUsageMonitor["codeJobName"]] = retValUsageMonitor["codeJobUUID"];

        const settingsBodyADAL = {
            Key: distributor.InternalID.toString(),
            Data: data
        };
        await monitorSettingsService.setMonitorSettings(settingsBodyADAL)

        await upsertVarSettingsRelation(relationVarSettingsService);

        console.log('HealthMonitorAddon installed succeeded.');
        return {
            success: success,
            errorMessage: errorMessage,
            resultObject: resultObject
        };
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error, 'message', 'Cannot install HealthMonitorAddon. Unknown Error Occured');

        return {
            success: false,
            errorMessage: errorMessage,
        };
    }
};

exports.uninstall = async (client: Client, request: Request) => {
    try {
        const monitorSettingsService = new MonitorSettingsService(client);
        const monitorSettings = await monitorSettingsService.getMonitorSettings();
        const relationVarSettingsService = new VarRelationService(client);

        // unschedule SyncFailed test
        let syncFailedCodeJobUUID = monitorSettings.SyncFailedCodeJobUUID;
        if (syncFailedCodeJobUUID != null && syncFailedCodeJobUUID != '') {
            await monitorSettingsService.papiClient.codeJobs.upsert({
                UUID: syncFailedCodeJobUUID,
                CodeJobName: "SyncFailed Test",
                IsScheduled: false,
                CodeJobIsHidden: true
            });
        }
        console.log('SyncFailed codejob unschedule succeeded.');

        // unschedule JobLimitReached test
        let jobLimitReachedCodeJobUUID = monitorSettings.JobLimitReachedCodeJobUUID
        if (jobLimitReachedCodeJobUUID != null && jobLimitReachedCodeJobUUID != '') {
            await monitorSettingsService.papiClient.codeJobs.upsert({
                UUID: jobLimitReachedCodeJobUUID,
                CodeJobName: "JobLimitReached Test",
                IsScheduled: false,
                CodeJobIsHidden: true
            });
        }
        console.log('JobLimitReached codejob unschedule succeeded.');

        // unschedule JobExecutionFailed test
        let jobExecutionFailedCodeJobUUID = monitorSettings.JobExecutionFailedCodeJobUUID;
        if (jobExecutionFailedCodeJobUUID != null && jobExecutionFailedCodeJobUUID != '') {
            await monitorSettingsService.papiClient.codeJobs.upsert({
                UUID: jobExecutionFailedCodeJobUUID,
                CodeJobName: "JobExecutionFailed Test",
                IsScheduled: false,
                CodeJobIsHidden: true
            });
        }
        console.log('JobExecutionFailed codejob unschedule succeeded.');

        // unschedule DailyAddonUsage
        let dailyAddonUsageCodeJobUUID = monitorSettings.DailyAddonUsageCodeJobUUID;
        if (dailyAddonUsageCodeJobUUID != null && dailyAddonUsageCodeJobUUID != '') {
            await monitorSettingsService.papiClient.codeJobs.upsert({
                UUID: dailyAddonUsageCodeJobUUID,
                CodeJobName: "DailyAddonUsage",
                IsScheduled: false,
                CodeJobIsHidden: true
            });
        }
        console.log('DailyAddonUsage codejob unschedule succeeded.');

        /* // unschedule UsageMonitor
        let UsageMonitorCodeJobUUID = monitorSettings.UsageMonitorCodeJobUUID;
        if(UsageMonitorCodeJobUUID != '') {
            await service.papiClient.codeJobs.upsert({
                UUID:UsageMonitorCodeJobUUID,
                CodeJobName: "Pepperi Usage Monitor Addon Code Job",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('UsageMonitor codejob unschedule succeeded.'); */

        // purge ADAL tables
        var headersADAL = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        }
        const responseDailyAddonUsageTable = await monitorSettingsService.papiClient.post('/addons/data/schemes/DailyAddonUsage/purge', null, headersADAL);
        const responseSettingsTable = await monitorSettingsService.papiClient.post('/addons/data/schemes/HealthMonitorSettings/purge', null, headersADAL);
        await upsertVarSettingsRelation(relationVarSettingsService, false);

        console.log('HealthMonitorAddon uninstalled succeeded.');

        return {
            success: true,
            errorMessage: '',
            resultObject: {}
        };
    }
    catch (err) {
        const errorMessage = Utils.GetErrorDetailsSafe(err, 'message', 'Failed to delete codejobs of HealthMonitor Addon');

        return {
            success: false,
            errorMessage: errorMessage,
            resultObject: {}
        };
    }
};

exports.upgrade = async (client: Client, request: Request) => {

    let success = true;
    let resultObject = {};

    const monitorSettingsService = new MonitorSettingsService(client);
    const relationVarSettingsService = new VarRelationService(client);

    try {
        let addon = await monitorSettingsService.papiClient.addons.installedAddons.addonUUID(client.AddonUUID).get();
        const version = addon?.Version?.split('.').map(item => { return Number(item) }) || [];

        // upgrade to 2.0 or 1.0 versions
        if (version.length == 3 && version[0] < 2) {
            const additionalData = addon.AdditionalData ? addon.AdditionalData : "";
            let data = JSON.parse(additionalData);

            // upgrade to version 2.1.0 - move addon settings from additional data to ADAL
            const bodyADAL: AddonDataScheme = {
                Name: 'HealthMonitorSettings',
                Type: 'meta_data'
            };
            const headersADAL = {
                "X-Pepperi-OwnerID": client.AddonUUID,
                "X-Pepperi-SecretKey": client.AddonSecretKey
            };
            const currentMemoryUsageLimit = (await monitorSettingsService.getMonitorSettings()).MemoryUsageLimit

            const responseSettingsTable = await monitorSettingsService.papiClient.post('/addons/data/schemes', bodyADAL, headersADAL);
            const distributor = await GetDistributor(monitorSettingsService.papiClient);
            const monitorLevel = await monitorSettingsService.papiClient.get('/meta_data/flags/MonitorLevel');
            const memoryUsageLimit = await monitorSettingsService.papiClient.get('/meta_data/flags/MemoryUsageLimit');
            data["MonitorLevel"] = (monitorLevel == false) ? 4 : monitorLevel;
            data["MemoryUsageLimit"] = (currentMemoryUsageLimit === undefined) ? DEFAULT_MEMORY_USAGE : currentMemoryUsageLimit;
            const settingsBodyADAL = {
                Key: distributor.InternalID.toString(),
                Data: data
            };
            const settingsResponse = await monitorSettingsService.papiClient.addons.data.uuid(client.AddonUUID).table('HealthMonitorSettings').upsert(settingsBodyADAL);

            console.log('HealthMonitor upgrade from additional data to ADAL succeeded.');
        }

        await upsertVarSettingsRelation(relationVarSettingsService);

        console.log('HealthMonitorAddon upgrade succeeded.');
        return {
            success: success,
            resultObject: resultObject
        };
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error, 'message', 'Failed to upgrade HealthMonitor Addon');

        return {
            success: false,
            errorMessage: errorMessage
        };
    }
};

exports.downgrade = async (client: Client, request: Request) => {
    return { success: true, resultObject: {} };
};

//#region install code jobs

async function InstallJobLimitReached(monitorSettingsService: MonitorSettingsService) {
    let retVal = {
        success: true,
        errorMessage: ''
    };

    try {
        let codeJob = await CreateAddonCodeJob(monitorSettingsService, "JobLimitReached Test", "JobLimitReached Test for HealthMonitor Addon. Check distributor not pass the addons execution limit.", "api",
            "job_limit_reached", GetJobLimitCronExpression(monitorSettingsService.clientData.OAuthAccessToken));
        retVal["codeJobName"] = 'JobLimitReachedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        retVal = {
            success: false,
            errorMessage: errorMessage
        };
    }
    return retVal;
}

async function InstallAddonLimitReached(monitorSettingsService: MonitorSettingsService) {
    let retVal = {
        success: true,
        errorMessage: ''
    };

    try {
        let codeJob = await CreateAddonCodeJob(monitorSettingsService, "AddonLimitReached Test", "AddonLimitReached Test for HealthMonitor Addon. Check distributor not pass the addons execution limit.", "api",
            "addon_limit_reached", GetAddonLimitCronExpression(monitorSettingsService.clientData.OAuthAccessToken));
        retVal["codeJobName"] = 'AddonLimitReachedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        retVal = {
            success: false,
            errorMessage: errorMessage
        };
    }
    return retVal;
}

async function InstallJobExecutionFailed(monitorSettingsService: MonitorSettingsService) {
    let retVal = {
        success: true,
        errorMessage: ''
    };

    try {
        let codeJob = await CreateAddonCodeJob(monitorSettingsService, "JobExecutionFailed Test", "JobExecutionFailed Test for HealthMonitor Addon.", "api",
            "job_execution_failed", GetJobExecutionCronExpression(monitorSettingsService.clientData.OAuthAccessToken));
        retVal["codeJobName"] = 'JobExecutionFailedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        retVal = {
            success: false,
            errorMessage: errorMessage
        };
    }
    return retVal;
}

async function InstallDailyAddonUsage(monitorSettingsService: MonitorSettingsService) {
    let retVal = {
        success: true,
        errorMessage: ''
    };

    try {
        let codeJob = await CreateAddonCodeJob(monitorSettingsService, "DailyAddonUsage", "DailyAddonUsage for HealthMonitor Addon.", "addon-usage",
            "daily_addon_usage", GetDailyAddonUsageCronExpression(monitorSettingsService.clientData.OAuthAccessToken));
        retVal["codeJobName"] = 'DailyAddonUsageCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;

        // add table to ADAL
        const bodyDailyAddonUsageTable: AddonDataScheme = {
            Name: 'DailyAddonUsage',
            Type: 'meta_data'
        };
        const headersADAL = {
            "X-Pepperi-OwnerID": monitorSettingsService.clientData.addonUUID,
            "X-Pepperi-SecretKey": monitorSettingsService.clientData.addonSecretKey
        }
        const responseDailyAddonUsageTable = await monitorSettingsService.papiClient.post('/addons/data/schemes', bodyDailyAddonUsageTable, headersADAL);
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        retVal = {
            success: false,
            errorMessage: errorMessage
        };
    }
    return retVal;
}

//#endregion


//#region private functions

export const PepperiUsageMonitorTable: AddonDataScheme = {
    Name: "PepperiUsageMonitor",
    Type: "data"
}

export function GetMonitorCronExpression(token, maintenanceWindowHour, interval) {
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid']) % interval;
    const minute = rand + "-59/" + interval;
    let hour = '';

    // monitor will be disabled from 3 hours, starting one hour before maintenance window and finished one hour after
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

    return minute + " " + hour + " * * *";
}

function GetAddonLimitCronExpression(token) {
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid']) % 59;
    return rand + "-59/60 4 * * *";
}

function GetJobLimitCronExpression(token) {
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid']) % 59;
    return rand + "-59/60 6 * * *";
}

function GetJobExecutionCronExpression(token) {
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid']) % 59;
    return rand + "-59/60 8 * * *";
}

function GetDailyAddonUsageCronExpression(token) {
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid']) % 59;
    return rand + "-59/60 5 * * *";
}

async function InstallSyncFailed(monitorSettingsService: MonitorSettingsService) {
    let retVal = {
        success: true,
        errorMessage: ''
    };

    try {
        const mapDataMetaData = {
            TableID: "PepperiHealthMonitor",
            MainKeyType: { ID: 0, Name: "Any" },
            SecondaryKeyType: { ID: 0, Name: "Any" },
            Hidden: false,
            MemoryMode: {
                Dormant: false,
                Volatile: false
            }
        };
        const mapData = {
            MapDataExternalID: "PepperiHealthMonitor",
            MainKey: "MonitorSyncCounter",
            SecondaryKey: "",
            Values: ["0"]
        };

        const resultAddUDT = await monitorSettingsService.papiClient.metaData.userDefinedTables.upsert(mapDataMetaData as any);
        const resultAddUDTRow = await monitorSettingsService.papiClient.userDefinedTables.upsert(mapData);

        const maintenance = await monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get();
        const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);

        let monitorLevel = await monitorSettingsService.papiClient.get('/meta_data/flags/MonitorLevel');
        monitorLevel = (monitorLevel == false) ? 4 : monitorLevel;
        const interval = monitorLevel > 1 ? 15 : 5;
        let codeJob = await CreateAddonCodeJob(monitorSettingsService, "SyncFailed Test", "SyncFailed Test for HealthMonitor Addon.", "api", "sync_failed", GetMonitorCronExpression(monitorSettingsService.clientData.OAuthAccessToken, maintenanceWindowHour, interval));

        retVal["mapDataID"] = resultAddUDTRow.InternalID;
        retVal["codeJobName"] = 'SyncFailedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
        retVal["interval"] = monitorLevel > 1 ? 15 : 5;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        retVal = {
            success: false,
            errorMessage: errorMessage
        };
    }
    return retVal;
}

async function CreateAddonCodeJob(monitorSettingsService: MonitorSettingsService, jobName, jobDescription, addonPath, functionName, cronExpression) {
    const codeJob = await monitorSettingsService.papiClient.codeJobs.upsert({
        CodeJobName: jobName,
        Description: jobDescription,
        Type: "AddonJob",
        IsScheduled: true,
        CronExpression: cronExpression,
        AddonPath: addonPath,
        FunctionName: functionName,
        AddonUUID: monitorSettingsService.clientData.addonUUID,
        NumberOfTries: 1
    });
    console.log("result object recieved from Code jobs is: " + JSON.stringify(codeJob));
    return codeJob;
}

async function GetDistributor(papiClient) {
    let distributorData = await papiClient.get('/distributor');
    const machineData = await papiClient.get('/distributor/machine');
    const distributor = {
        InternalID: distributorData.InternalID,
        Name: distributorData.Name,
        MachineAndPort: machineData.Machine + ":" + machineData.Port
    };
    return distributor;
}

function getCronExpression() {
    let expressions = [
        '0 19 * * FRI',
        '0 20 * * FRI',
        '0 21 * * FRI',
        '0 22 * * FRI',
        '0 23 * * FRI',
        '0 0 * * SAT',
        '0 1 * * SAT',
        '0 2 * * SAT',
        '0 3 * * SAT',
        '0 4 * * SAT',
        '0 5 * * SAT',
        '0 6 * * SAT',
        '0 7 * * SAT',
        '0 8 * * SAT',
        '0 9 * * SAT',
        '0 10 * * SAT',
        '0 11 * * SAT',
        '0 12 * * SAT',
        '0 13 * * SAT',
        '0 14 * * SAT',
        '0 15 * * SAT',
        '0 16 * * SAT',
        '0 17 * * SAT',
        '0 18 * * SAT',
        '0 19 * * SAT',
        '0 20 * * SAT',
        '0 21 * * SAT',
        '0 22 * * SAT',
        '0 23 * * SAT',
        '0 0 * * SUN',
        '0 1 * * SUN',
        '0 2 * * SUN',
        '0 3 * * SUN',
        '0 4 * * SUN',
    ]
    const index = Math.floor(Math.random() * expressions.length);
    return expressions[index];
}

async function upsertVarSettingsRelation(varRelationService: VarRelationService, install: boolean = true) {
    let relation = varRelationService.relation;

    if (!(install)) {
        relation.Hidden = true;
    }

    return await varRelationService.papiClient.addons.data.relations.upsert(relation);
}

//#endregion