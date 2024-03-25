import MonitorSettingsService from './monitor-settings.service'
import RelationsService from './relations.service';
import VarRelationService, { VALID_MONITOR_LEVEL_VALUES } from './relations.var.service'
import UsageRelationService from './relations.usage.service'
import { Utils } from './utils.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import { PapiClient } from "@pepperi-addons/papi-sdk";
import jwtDecode from "jwt-decode";
import fetch from "node-fetch";
import { ErrorInterface, ErrorInterfaceToHtmlTable, InnerErrorInterface, IsInstanceOfErrorInterface } from './error.interface';
import { DEFAULT_MONITOR_LEVEL } from './installation';
import { SyncTest } from './sync_test.service';
import { AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES, errors } from './entities';
import { AuditDataLogSyncService } from './elastic-sync.service';

const KEY_FOR_TOKEN = 'NagiosToken'

export async function get_sync_aggregations_from_elastic(client: Client, request: Request) {
    const auditDataLogSyncService = new AuditDataLogSyncService(client);
    return {
        "HourlySyncs": await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['syncAggregation'], { DataType: 'HourlySyncs', Offset: request.body.TimeZoneOffset }),
        "LastDaySyncs": await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['syncAggregation'],  { DataType: 'LastDaySyncs', Offset: request.body.TimeZoneOffset }),
        "WeeklySyncs": await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['syncAggregation'],  { DataType: 'WeeklySyncs', Offset: request.body.TimeZoneOffset }),
        "MonthlySyncs": await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['syncAggregation'],  { DataType: 'MonthlySyncs', Offset: request.body.TimeZoneOffset })
    }
}

export async function get_monitor_level_value(client: Client, request: Request) {
    const auditDataLogSyncService = new AuditDataLogSyncService(client);
    return await auditDataLogSyncService.getMonitorLevel();
}

export async function get_internal_syncs_from_elastic(client: Client, request: Request) {
    const auditDataLogSyncService = new AuditDataLogSyncService(client);
    const syncBody = { CodeJobUUID: await auditDataLogSyncService.getJobUUID(), Params: request.body };

    return (await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['internalSyncs'], syncBody)) || {};
}

export async function get_kpi_aggregations(client: Client, request: Request) {
    const auditDataLogSyncService = new AuditDataLogSyncService(client);
    const uptimeSyncBody = await auditDataLogSyncService.getUptimeSyncData();
    return {
        "UptimeSync": await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['uptimeSync'], uptimeSyncBody)
    }
}

export async function get_syncs_from_elastic(client: Client, request: Request) {
    const auditDataLogSyncService = new AuditDataLogSyncService(client);
    return (await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['syncJobs'], request.body)) || {};
}

export async function get_smart_filters_from_elastic(client: Client, request: Request) {
    const auditDataLogSyncService = new AuditDataLogSyncService(client);
    const syncBody = { CodeJobUUID: await auditDataLogSyncService.getJobUUID(), Params: request.body.Params, DataType: request.body.DataType };

    return await auditDataLogSyncService.getAuditDataLogSync(AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES['smartFilters'], syncBody);
}

//#region health monitor api
//mechanism to check for sync failure - run an internal sync and update relevant webhooks 
export async function sync_failed(client: Client, request: Request) {
    console.log('HealthMonitorAddon start SyncFailed test');
    const monitorSettingsService = new MonitorSettingsService(client);
    let errorMessage = '';
    let lastStatus;
    let monitorSettings = {};
    let syncParams: any = {};
    let systemHealthBody = {
        Status: "",
        Message: ""
    }

    try {
        monitorSettings = await monitorSettingsService.getMonitorSettings();
    }
    catch (_) {
        await StatusUpdate(systemHealthBody, client, monitorSettingsService, false, false, 'GET-ADAL-FAILED')
    }

    let timeout = setTimeout(async function () {
        //return 'TIMEOUT-GET-UDT';
        await StatusUpdate(systemHealthBody, client, monitorSettingsService, false, false, 'TIMEOUT-SYNC-FAILED-TEST', '', monitorSettings);
    }, 270000); //4.5 minutes

    try{
        const syncTest = new SyncTest(client, monitorSettingsService, monitorSettings, systemHealthBody);
        lastStatus = monitorSettings['SyncFailed'] ? monitorSettings['SyncFailed'].Status : false;
        syncParams = await syncTest.syncMonitor();
        errorMessage = await StatusUpdate(systemHealthBody, client, monitorSettingsService, lastStatus, syncTest.succeeded, syncTest.errorCode, '', monitorSettings);
    }
    catch (error) {
        syncParams.succeeded = false;
        const innerError = Utils.GetErrorDetailsSafe(error, 'stack')
        // When there is an error, need to update the SystemHealthBody so that the right status will be published to the system health notifications
        systemHealthBody = {
            Status: 'ERROR',
            Message: innerError
        }
        errorMessage = await StatusUpdate(systemHealthBody, client, monitorSettingsService, false, syncParams.succeeded, 'UNKNOWN-ERROR', innerError, monitorSettings);
    }
    finally {
        clearTimeout(timeout);
    }

    return {
        success: syncParams.succeeded,
        errorMessage: errorMessage
    };
};


export async function job_limit_reached(client: Client, request: Request) {
    console.log('HealthMonitorAddon start JobLimitReached test');
    return;
    try {
        const monitorSettingsService = new MonitorSettingsService(client);
        const jobLimit = await JobLimitReachedTest(monitorSettingsService);
        return jobLimit;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }

};

export async function addon_limit_reached(client: Client, request: Request) {
    console.log('HealthMonitorAddon start AddonLimitReached test');
    return;
    try {
        const monitorSettingsService = new MonitorSettingsService(client);
        const checkAddonsExecutionLimit = await AddonLimitReachedTest(monitorSettingsService);
        return checkAddonsExecutionLimit;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};

export async function job_execution_failed(client: Client, request: Request) {
    console.log('HealthMonitorAddon start jobExecutionFailed test');
    return;

    try {
        const monitorSettingsService = new MonitorSettingsService(client);
        const relationsService = new RelationsService(client);

        const jobExecution = await JobExecutionFailedTest(monitorSettingsService, relationsService);
        return jobExecution;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        return {
            success: false,
            errorMessage: errorMessage
        };
    }
};

export async function health_monitor_settings(client: Client, request: Request) {
    const monitorSettingsService = new MonitorSettingsService(client);

    let monitorSettings = await monitorSettingsService.getMonitorSettings();
    delete monitorSettings.SyncFailed.Status;
    delete monitorSettings.SyncFailed.ErrorCounter;

    monitorSettings.SyncFailed.ID = 'SYNC-FAILED';
    monitorSettings.JobLimitReached.ID = 'JOB-LIMIT-REACHED';
    monitorSettings.JobExecutionFailed.ID = 'JOB-EXECUTION-FAILED';

    return [
        monitorSettings.SyncFailed,
        monitorSettings.JobLimitReached,
        monitorSettings.JobExecutionFailed
    ]
};

export async function health_monitor_type_alert_edit(client: Client, request: Request) {
    let codeJob;
    let typeData;
    //let dailyCheckTime;

    try {
        const monitorSettingsService = new MonitorSettingsService(client);
        let monitorSettings = await monitorSettingsService.getMonitorSettings();

        switch (request.body.Type) {
            case "SYNC-FAILED":
                typeData = monitorSettings.SyncFailed;
                break;
            case "JOB-LIMIT-REACHED":
                typeData = monitorSettings.JobLimitReached;
                break;
            case "JOB-EXECUTION-FAILED":
                typeData = monitorSettings.JobExecutionFailed;
                break;
            default:
                return;
        }

        //const cronExpression = codeJob.CronExpression.split(" ");
        //dailyCheckTime = cronExpression[1];
        return {
            "Email": typeData.Email,
            "Webhook": typeData.Webhook,
            //"DailyCheckTime":dailyCheckTime,
            "Interval": typeData.Interval
        }
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error, 'stack');

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};

export async function health_monitor_type_alert_save(client: Client, request: Request) {
    let codeJob;
    let lastInterval;
    //let dailyCheckTime;

    try {
        const papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        const monitorSettingsService = new MonitorSettingsService(client);
        let monitorSettings = await monitorSettingsService.getMonitorSettings();

        switch (request.body.Type) {
            case "SYNC-FAILED":
                codeJob = await monitorSettingsService.papiClient.get('/code_jobs/' + monitorSettings.SyncFailedCodeJobUUID);
                monitorSettings.SyncFailed.Webhook = request.body.Webhook;
                //monitorSettings.SyncFailed.Email = request.body.Email;
                lastInterval = monitorSettings.SyncFailed.Interval;
                monitorSettings.SyncFailed.Interval = request.body.Interval;
                break;
            case "JOB-LIMIT-REACHED":
                codeJob = await monitorSettingsService.papiClient.get('/code_jobs/' + monitorSettings.JobLimitReachedCodeJobUUID);
                monitorSettings.JobLimitReached.Webhook = request.body.Webhook;
                //monitorSettings.JobLimitReached.Email = request.body.Email;
                lastInterval = monitorSettings.JobLimitReached.Interval;
                monitorSettings.JobLimitReached.Interval = request.body.Interval;
                break;
            case "JOB-EXECUTION-FAILED":
                codeJob = await monitorSettingsService.papiClient.get('/code_jobs/' + monitorSettings.JobExecutionFailedCodeJobUUID);
                monitorSettings.JobExecutionFailed.Webhook = request.body.Webhook;
                //monitorSettings.JobExecutionFailed.Email = request.body.Email;
                lastInterval = monitorSettings.JobExecutionFailed.Interval;
                monitorSettings.JobExecutionFailed.Interval = request.body.Interval;
                break;
            default:
                return;
        }

        // if inteval changed than change the cron expression of the code job 
        if (lastInterval !== request.body.Interval) {
            const seconds = request.body.Interval / 1000;
            const minutes = seconds / 60;
            const hours = minutes / 60;
            let updatedCronExpression;
            const maintenance = await papiClient.metaData.flags.name('Maintenance').get();
            const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);

            if (hours > 1) {
                updatedCronExpression = await GetCronExpression(client.OAuthAccessToken, maintenanceWindowHour, false, true, hours); // based on the choise on the UI
            }
            else {
                updatedCronExpression = await GetCronExpression(client.OAuthAccessToken, maintenanceWindowHour, true, false, minutes); // based on the choise on the UI
            }

            const codeJobResponse = await UpdateCodeJobCronExpression(papiClient, codeJob, updatedCronExpression);
        }

        const settingsResponse = await monitorSettingsService.setMonitorSettings(monitorSettings);

        return {
            Success: true,
            resultObject: "Update finished",
        }
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error, 'stack');

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};

export async function health_monitor_dashboard(client: Client, request: Request) {
    const result = {
        LastSync: {},
        JobTimeUsage: {},
        PendingActions: {},
        SyncStatus: {},
        DailySync: {},
        Alerts: {}
    };

    try {
        const monitorSettingsService = new MonitorSettingsService(client);

        const timeZone = request.query.time_zone;
        const lastSyncResult = await monitorSettingsService.papiClient.get("/audit_logs?fields=Status.ID,ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName ='sync'&page_size=1&order_by=ModificationDateTime desc");
        const lastSyncTime = new Date(lastSyncResult[0]["ModificationDateTime"]);
        const time = lastSyncTime.toLocaleTimeString('en-US', {timeZone: timeZone, hour12: false});
        result.LastSync = { Time: time, Status: lastSyncResult[0]["Status.ID"] };

        const lastDay = new Date(Date.now() - 86400 * 1000);
        const firstHour = lastDay.getHours();
        let labelArray = new Array();

        const listPromises: Promise<any>[] = [];
        let i = 0;
        let lowerRange = new Date(lastDay.setMinutes(0));
        let upperRange = new Date(Date.parse(lowerRange.toISOString()) + 60 * 60 * 1000);
        for (i = 0; i <= 24; i++) {
            const hour = ((firstHour + i) % 24).toString();
            labelArray.push(hour);
            listPromises.push(monitorSettingsService.papiClient.get("/audit_logs?fields=ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName='sync' and Status.ID=1 and ModificationDateTime between '" + lowerRange.toISOString() + "' And '" + upperRange.toISOString() + "'&page_size=1000&order_by=ModificationDateTime asc")); //success
            listPromises.push(monitorSettingsService.papiClient.get("/audit_logs?fields=ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName='sync' and (Status.ID=0 or (Status.ID>1 and AuditInfo.JobMessageData.NumberOfTry>2)) and ModificationDateTime between '" + lowerRange.toISOString() + "' And '" + upperRange.toISOString() + "'&page_size=1000&order_by=ModificationDateTime asc")); //failure
            lowerRange = new Date(Date.parse(lowerRange.toISOString()) + 60 * 60 * 1000);
            upperRange = new Date(Date.parse(upperRange.toISOString()) + 60 * 60 * 1000);
        }

        //fix UI of labels
        for (var j in labelArray) {
            if (labelArray[j].length == 1) {
                labelArray[j] = "0" + labelArray[j] + ":00"
            }
            else {
                labelArray[j] = labelArray[j] + ":00"
            }
        }

        await Promise.all(listPromises).then(
            function (res) {
                let successCount = 0;
                let delayedCount = 0;
                let successArray = new Array();
                let delayedArray = new Array();
                i = 0;
                while (i < res.length) {
                    successCount = successCount + res[i].length;
                    delayedCount = delayedCount + res[i + 1].length;
                    successArray.push(res[i].length);
                    delayedArray.push(res[i + 1].length);
                    i = i + 2;
                }
                result.SyncStatus = { Success: successCount, Delayed: delayedCount };
                result.DailySync = { Labels: labelArray, Success: successArray, Delayed: delayedArray };
            }
        );

        const addons = await monitorSettingsService.papiClient.get('/addons?page_size=-1');

        //there are logs stuck on in progress, maybe show one month back
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekString = lastWeek.toISOString();
        const pendingActionsResult = await monitorSettingsService.papiClient.get("/audit_logs?fields=UUID,CreationDateTime,AuditInfo.JobMessageData.FunctionName,Event.User.Email,AuditInfo.JobMessageData.NumberOfTry,AuditInfo.JobMessageData.NumberOfTries,AuditInfo.JobMessageData.AddonData.AddonUUID,Status.Name&where=Status.ID!=0 and Status.ID!=1 and CreationDateTime>'" + lastWeekString + "'&page_size=1000&order_by=CreationDateTime desc");
        let pendingActionsValidateResult = new Array();
        for (var j in pendingActionsResult) {
            if (pendingActionsResult[j]["AuditInfo.JobMessageData.FunctionName"] == undefined || pendingActionsResult[j]["AuditInfo.JobMessageData.AddonData.AddonUUID"] == undefined) {
                continue;
            }
            let addonUUID = pendingActionsResult[j]["AuditInfo.JobMessageData.AddonData.AddonUUID"];

            //prepare the data format for the UI
            if (addons.filter(x => x.UUID == addonUUID).length == 1) {
                if (addons.filter(x => x.UUID == addonUUID)[0].Name == 'HealthMonitor') {
                    continue;
                }
                pendingActionsResult[j]["AuditInfo.JobMessageData.AddonData.AddonUUID"] = addons.filter(x => x.UUID == addonUUID)[0].Name;
            }
            else {
                continue;
            }

            let email = pendingActionsResult[j]["Event.User.Email"].toString();
            if (email.startsWith("SupportAdminUser")) {
                pendingActionsResult[j]["Event.User.Email"] = "Pepperi Admin";
            }
            pendingActionsResult[j]["CreationDateTime"] = new Date(pendingActionsResult[j]["CreationDateTime"]).toLocaleString();

            pendingActionsResult[j]["AuditInfo.JobMessageData.NumberOfTry"] = pendingActionsResult[j]["AuditInfo.JobMessageData.NumberOfTry"] + "/" + pendingActionsResult[j]["AuditInfo.JobMessageData.NumberOfTries"];
            pendingActionsValidateResult.push(pendingActionsResult[j]);
        }
        result.PendingActions = { Count: pendingActionsValidateResult.length, List: JSON.stringify(pendingActionsValidateResult) };

        const jobTimeUsageResult = await monitorSettingsService.papiClient.get('/code_jobs/execution_budget');
        if ((jobTimeUsageResult.UsedBudget + jobTimeUsageResult.FreeBudget) == 0) {
            result.JobTimeUsage = { Percantage: 100 };
        }
        else {
            const currentPercantage = parseFloat(((jobTimeUsageResult.UsedBudget / (jobTimeUsageResult.UsedBudget + jobTimeUsageResult.FreeBudget)) * 100).toFixed(2));
            result.JobTimeUsage = { Percantage: currentPercantage };
        }

        return result;
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error, 'stack');

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }

};

export async function run_now(client: Client, request: Request) {
    let result;
    let message;

    switch (request.body.Type) {
        case "SYNC-FAILED":
            request.body.RunNow = true;
            result = await sync_failed(client, request);
            if (result.success) {
                message = "Sync is successful";
            }
            else {
                message = "Sync failed";
            }
            break;
        // case "JOB-LIMIT-REACHED":
        //     result = await job_limit_reached(client, request);
        //     message = "Job usage is " + result.jobUsage + "%."
        //     break;
        // case "JOB-EXECUTION-FAILED":
        //     result = await job_execution_failed(client, request);
        //     message = result.resultObject;
        //     break;
        default:
            message = "This run now test type does not exist.";
    }

    return message;

};

export async function send_test_message(client: Client, request: Request) {
    try {
        const monitorSettingsService = new MonitorSettingsService(client);
        ReportErrorWebhook(monitorSettingsService, 'TEST-MESSAGE', request.body.Type);

        return "Webhook sent"
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error, 'stack');
        return "Error: " + errorMessage
    }
};

export async function var_settings_callback(client: Client, request: Request) {
    const varRelationService: VarRelationService = new VarRelationService(client);

    try {
        if (request.method === 'POST') {
            // Getting updated values from Var settings
            return varRelationService.var_get_updated_settings(client, request);
        }
        else if (request.method === 'GET') {
            // Sending updated values to Var settings
            return varRelationService.var_send_current_settings(client, request);
        }
        else {
            throw new Error(`Method ${request.method} is not supported`)
        }
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);
        console.error(errorMessage);
        throw error;
    }
}

export async function usage_callback(client: Client, request: Request) {
    const usageRelationService: UsageRelationService = new UsageRelationService(client);

    try {
        if (request.method === 'GET') {
            return await usageRelationService.getUsageData(client)
        }
        else {
            throw new Error(`Method ${request.method} is not supported`)
        }
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);
        console.error(errorMessage);
        throw error;
    }
}

//#endregion

//#region health monitor tests
export async function AddonLimitReachedTest(monitorSettingsService) {
    console.log("HealthMonitorAddon, AddonLimitReachedTest start check addons execution limit");
    try {
        var resultItems = { PassedLimitItems: new Array(), NotPassedLimitItems: new Array() };
        console.log("AddonLimitReachedTest: send post request to /addons/code_jobs_limits");
        const result = await monitorSettingsService.papiClient.post(`/addons/code_jobs_limits`);
        console.log("AddonLimitReachedTest: number of items return from function = " + Object.keys(result).length);
        if (result != null && Object.keys(result).length > 0) {
            for (var item in result) {
                if (result[item].IsPassedTheLimit != null && result[item].IsPassedTheLimit == true) {
                    const innerMessage = "AddonUUID " + item + " reached the limit - " + result[item].PercentageFromLimit;
                    ReportError(monitorSettingsService, await GetDistributor(monitorSettingsService), "PASSED-ADDON-LIMIT", "ADDON-LIMIT-REACHED", innerMessage);
                    resultItems["PassedLimitItems"].push(item);
                }
                else if (result[item].IsPassedTheLimit != null && result[item].IsPassedTheLimit == false) {
                    resultItems["NotPassedLimitItems"].push(item);
                }
            }
        }

        console.log("HealthMonitorAddon, AddonLimitReachedTest finish check addons execution limit");
        console.log(JSON.stringify(resultItems));
        return {
            success: true,
            resultObject: resultItems
        };
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};

export async function JobLimitReachedTest(monitorSettingsService) {
    console.log("HealthMonitorAddon, JobLimitReachedTest start check execution budget limit");
    let lastPercantage;
    let currentPercantage;
    let innerMessage;
    let reportSent = false;

    try {
        console.log("JobLimitReachedTest: send get request to code_jobs/execution_budget");
        const result = await monitorSettingsService.papiClient.get('/code_jobs/execution_budget');
        let monitorSettings = await monitorSettingsService.getMonitorSettings();
        lastPercantage = monitorSettings.JobLimitReached.LastPercantage;

        currentPercantage = parseFloat(((result.UsedBudget / (result.UsedBudget + result.FreeBudget)) * 100).toFixed(2));
        innerMessage = "You have reached " + currentPercantage + "% of your job limits.";

        if (currentPercantage >= 80 && currentPercantage < 90) {
            if (lastPercantage < 80) {
                ReportError(monitorSettingsService, await GetDistributorCache(monitorSettingsService, monitorSettings), "PASSED-JOB-LIMIT", "JOB-LIMIT-REACHED", innerMessage);
                reportSent = true;
            }
        }
        else if (currentPercantage >= 90 && currentPercantage < 95) {
            if (lastPercantage < 90) {
                ReportError(monitorSettingsService, await GetDistributorCache(monitorSettingsService, monitorSettings), "PASSED-JOB-LIMIT", "JOB-LIMIT-REACHED", innerMessage);
                reportSent = true;
            }
        }
        else if (currentPercantage >= 95) {
            if (lastPercantage < 95) {
                ReportError(monitorSettingsService, await GetDistributorCache(monitorSettingsService, monitorSettings), "PASSED-JOB-LIMIT", "JOB-LIMIT-REACHED", innerMessage);
                reportSent = true;
            }
        }

        if (!reportSent) {
            await ReportErrorCloudWatch(await GetDistributorCache(monitorSettingsService, monitorSettings), "JOB-LIMIT-SUCCESS", "JOB-LIMIT-REACHED", innerMessage);
        }

        console.log(innerMessage);
        monitorSettings.JobLimitReached.LastPercantage = currentPercantage;
        const settingsResponse = await monitorSettingsService.setMonitorSettings(monitorSettings);

        console.log("HealthMonitorAddon, JobLimitReachedTest finish check execution budget limit");
        return {
            success: true,
            jobUsage: currentPercantage,
            resultObject: innerMessage
        };
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};

export async function JobExecutionFailedTest(monitorSettingsService: any, relationsService: any) {
    console.log("HealthMonitorAddon, JobExecutionFailedTest start");
    let innerMessage;

    try {
        let monitorSettings = await monitorSettingsService.getMonitorSettings();
        const distributorCache = await GetDistributorCache(monitorSettingsService, monitorSettings);
        const interval = monitorSettings.JobExecutionFailed.Interval;
        const intervalDate = new Date(Date.now() - interval).toISOString();
        const intervalUTCDate = new Date(Date.now() - interval).toUTCString();
        const auditLogsResult = await monitorSettingsService.papiClient.get("/audit_logs?where=AuditInfo.JobMessageData.IsScheduled=true and Status.ID=0 and ModificationDateTime>'" + intervalDate + "' and AuditInfo.JobMessageData.FunctionName!='monitor' and AuditInfo.JobMessageData.FunctionName!='sync_failed'&order_by=ModificationDateTime desc");
        const type = "JOB-EXECUTION-FAILED";
        const code = "JOB-EXECUTION-REPORT";
        const reports: ErrorInterface[] = new Array();

        const reportAsInterface: ErrorInterface = {
            DistributorID: distributorCache.InternalID,
            Name: distributorCache.Name,
            Code: code,
            Type: type,
            AddonUUID: "",
            GeneralErrorMessage: errors[code]["Message"],
            InternalErrors: []
        }
        let reportsDetails: InnerErrorInterface[] = new Array();

        // In the reports array, all audit logs are one report, and each relation error is a report.
        for (var auditLog in auditLogsResult) {
            // Reformating the time stamp
            let creationDateTime = auditLogsResult[auditLog].CreationDateTime as string;
            creationDateTime = creationDateTime.replace('T', ' ').replace('Z', '').replace(/\..+/, '');

            const reportDetails: InnerErrorInterface = {
                ActionUUID: auditLogsResult[auditLog].AuditInfo.JobMessageData.UUID,
                CreationDateTime: creationDateTime,
                ErrorMessage: `Addon UUID: ${auditLogsResult[auditLog].AuditInfo.JobMessageData.AddonData.AddonUUID}\n Error Message: ${auditLogsResult[auditLog].AuditInfo.ErrorMessage}`,
            }
            reportsDetails.push(reportDetails);

        }
        reportAsInterface.InternalErrors = reportsDetails;

        if (IsInstanceOfErrorInterface(reportAsInterface)) {
            reports.push(reportAsInterface);
        } else {
            console.error(`Invalid error details from audit: ${JSON.stringify(reportAsInterface)}`);
        }

        // Calling all the addons that subscribed to HealthMonitor relation
        const errorsFromHostees: [ErrorInterface] = await relationsService.getErrorsFromHostees(monitorSettingsService, distributorCache);
        reports.push(...errorsFromHostees);

        if (reports.length == 0) {
            const reportMessage = "No new errors were found since " + intervalUTCDate + ".";
            await ReportErrorCloudWatch(await GetDistributorCache(monitorSettingsService, monitorSettings), code, type, innerMessage);
            console.log("HealthMonitorAddon, JobExecutionFailedTest finish");
            return {
                success: true,
                resultObject: reportMessage
            };
        }

        await Promise.all(reports.map(async (report) => {
            let resultTable = ""
            if ('InternalErrors' in report) {
                resultTable = ErrorInterfaceToHtmlTable(report.InternalErrors!);
            }
            const errorString = JSON.stringify(report.InternalErrors);
            await ReportError(monitorSettingsService, distributorCache, report.Code, report.Type, errorString, resultTable, report.AddonUUID, report.GeneralErrorMessage);

        }))

        console.log("HealthMonitorAddon, JobExecutionFailedTest finish");
        return {
            success: false,
            resultObject: JSON.stringify(reports)
        };
    }
    catch (error) {
        const errorMessage = Utils.GetErrorDetailsSafe(error);

        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};


//#endregion

//#region private functions

async function validateBeforeTest(monitorSettingsService, monitorSettings) {
    // check if monitor level is default
    if (monitorSettings.MonitorLevel === DEFAULT_MONITOR_LEVEL) {
        return false;
    }

    // Check if we had a successful sync in the last 2 minutes, if so don't perform test
    const twoMinutesAgo = new Date(Date.now() - 150 * 1000).toISOString();
    const currentSync = await monitorSettingsService.papiClient.get("/audit_logs?fields=ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName='sync' and ModificationDateTime>'" + twoMinutesAgo + "' and Status.ID=1");
    if (currentSync.length > 0) {
        console.log('There was a successful sync at the last 150 seconds.');
        return false;
    }

    return true;
}


async function ReportError(monitorSettingsService: MonitorSettingsService, distributor, errorCode, type, innerMessage = "", htmlTable = "", addonUUID = "", generalErrorMessage = "") {
    const environmant = jwtDecode(monitorSettingsService.clientData.OAuthAccessToken)["pepperi.datacenter"];

    // report error to log
    const errorMessage = await ReportErrorCloudWatch(distributor, errorCode, type, innerMessage, generalErrorMessage);

    // report error to teams on System Status chanel
    await ReportErrorTeams(monitorSettingsService, environmant, distributor, errorCode, type, innerMessage, htmlTable, addonUUID, generalErrorMessage);

    // report error to webhook
    await ReportErrorWebhook(monitorSettingsService, errorCode, type, innerMessage, generalErrorMessage);

    // report error to Nagios
    //await ReportErrorToNagios(monitorSettingsService.papiClient, distributor.InternalID, errorCode, generalErrorMessage)

    return errorMessage;
}

async function ReportErrorCloudWatch(distributor, errorCode, type, innerMessage = "", generalErrorMessage = "") {
    let error = "";
    const generalMessage = (generalErrorMessage == "" && errorCode in errors) ? errors[errorCode]["Message"] : generalErrorMessage;
    error = 'DistributorID: ' + distributor.InternalID
        + '\n\rName: ' + distributor.Name
        + '\n\rType: ' + type
        + '\n\rCode: ' + errorCode
        + '\n\rGeneralErrorMessage: ' + generalMessage
        + '\n\InternalErrors: ' + innerMessage;

    errorCode == 'SUCCESS' ? console.log(error) : console.error(error);
    return error;
}

export async function ReportErrorTeamsDriver(client: Client, request: Request) {
    const service = new MonitorSettingsService(client);
    const environmant = 'sandbox';//jwtDecode(service.clientData.OAuthAccessToken)["pepperi.datacenter"];
    //const environmant = 'production';
    const distributor = await GetDistributor(service);
    //const errorCode = "SYNC-CALL-FAILED";
    const errorCode = "SUCCESS";
    const type = "SYNC-FAILED";
    const innerMessage = "Test by Meital";

    await ReportErrorTeams(service, environmant, distributor, errorCode, type, innerMessage);
}

async function ReportErrorTeams(monitorSettingsService, environmant, distributor, errorCode, type, innerMessage = "", htmlTable = "", addonUUID = "", generalErrorMessage = "") {
    let url = '';
    let body = {
        themeColor: errorCode in errors ? errors[errorCode]["Color"] : 'FF0000',
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
                name: "Addon UUID",
                value: addonUUID
            }, {
                name: "General Error Message",
                value: (generalErrorMessage == "" && errorCode in errors) ? errors[errorCode]["Message"] : generalErrorMessage
            }, {
                name: "Internal Errors",
                value: htmlTable == "" ? innerMessage : "See below"
            }],
            "markdown": true
        },
        {
            "startGroup": true,
            "text": htmlTable
        }],
    };
    let unite = false;
    let varUpdated = true;

    if (type == "SYNC-FAILED") {
        const alertBody = {
            DistributorID: distributor.InternalID,
            AlertCode: errorCode
        };
        try {
            const alertLogicResponse = await monitorSettingsService.papiClient.post('/var/addons/health_monitor/alerts', alertBody);
            if (alertLogicResponse.Count >= 5) {
                unite = true;
                const alert = errorCode == 'SUCCESS' ? alertLogicResponse.Count % 10 == 0 : new Date(alertLogicResponse.TopAlerts[0].Value).getMinutes() > new Date(alertLogicResponse.TopAlerts[1].Value).getMinutes();
                if (alert) {
                    body = {
                        themeColor: errors[errorCode]["Color"] == "00FF00" ? "FFFF00" : errors[errorCode]["Color"],
                        Summary: `Errors on ${alertLogicResponse.Count} distributors`,
                        sections: [{
                            facts: [{
                                name: "Distributors",
                                value: alertLogicResponse.Count.toString()
                            }, {
                                name: "Code",
                                value: alertLogicResponse.AlertCode
                            }, {
                                name: "Type",
                                value: type
                            },
                            {
                                name: "Message",
                                value: errors[alertLogicResponse.AlertCode]["Message"]
                            }],
                            "markdown": true
                        }],
                    };
                }
                else {
                    return;
                }
            }
        }
        catch (_) {
            varUpdated = false;
        }
    }

    // Changed urls to use new configuration for Teams.
    if (environmant == 'sandbox') {
        if (errorCode == 'SUCCESS')
            if (unite) //yellow icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/cb540659239545cc8be681c2a51f8c7e/4361420b-8fde-48eb-b62a-0e34fec63f5c';
            else //green icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/a9e46257d73a40b39b563b77dc6abe6a/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        else { // red icon
            url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/e5f4ab775d0147ecbb7f0f6bdf70aa0b/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        }
    }
    else {
        if (errorCode == 'SUCCESS')
            if (unite) //yellow icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/628bc029561b4d76875a2b5c0b48c58f/4361420b-8fde-48eb-b62a-0e34fec63f5c';
            else //green icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/400154cd59544fd583791a2f99641189/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        else { // red icon
            url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/0db0e56f12044634937712db79f704e1/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        }
    }

    var res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body)
    });
}

async function ReportErrorWebhook(monitorSettingsService, errorCode, type, innerMessage = "", generalErrorMessage = "") {
    //need to decide which errors the admin can get
    let url = "";
    let testType = "";
    const monitorSettings = await monitorSettingsService.getMonitorSettings();

    switch (type) {
        case "SYNC-FAILED":
            url = monitorSettings.SyncFailed.Webhook;
            testType = monitorSettings.SyncFailed.Type;
            break;
        case "JOB-LIMIT-REACHED":
            url = monitorSettings.JobLimitReached.Webhook;
            testType = monitorSettings.JobLimitReached.Type;
            break;
        case "JOB-EXECUTION-FAILED":
            url = monitorSettings.JobExecutionFailed.Webhook;
            testType = monitorSettings.JobExecutionFailed.Type;
            break;
        default:
            return;
    }

    if (innerMessage == "") {
        innerMessage = (generalErrorMessage == "" && errorCode in errors) ? errors[errorCode]["Message"] : generalErrorMessage
    }

    const body = {
        Summary: testType,
        sections: [{
            facts: [{
                name: "Date",
                value: new Date(Date.now()).toUTCString()
            }, {
                name: "Type",
                value: testType
            }, {
                name: "Message",
                value: innerMessage
            }],
            "markdown": true
        }],
    }

    if (url) {
        var res = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body)
        });
    }
}

async function ReportErrorToNagios(papiClient: PapiClient, distributorID: string, service: string, message: string) {
    let token = ''
    try {
        token = (await papiClient.get(`/kms/parameters/${KEY_FOR_TOKEN}`)).Value
    } catch (error) {
        console.error(`Could not get nagios token - will not send status, error: ${JSON.stringify(error)}`)
        return
    }
    
    const state = getNagiosReportState(service)
    const url = "https://nagios.pepperi.com/nrdp/"
    const cmd = "submitcheck"

    const checkResultObject = {
        "checkresults": [
            {
                "checkresult": {
                    "type": "host"
                },
                "hostname": `${distributorID}`,
                "state": `${state}`,
                "output": `${message}`
            },
            {
                "checkresult": {
                    "type": "service"
                },
                "hostname": `${distributorID}`,
                "servicename": `${service}`,
                "state": `${state}`,
                "output": `${message}`
            }
        ]
    }

    const urlWithParameters = url + '?' + `token=${token}` + '&' + `cmd=${cmd}` + '&' + `json=${JSON.stringify(checkResultObject)}`
    var nagiosResponse = await (await fetch(urlWithParameters, { method: "POST" })).json();

    if (nagiosResponse.result.status == 0) {
        console.log(JSON.stringify({Result: "Sent data to Nagios", Response: nagiosResponse}))
    } else {
        console.error(JSON.stringify({Result: "Could not send data to Nagios", Response: nagiosResponse}))
    }
}

function getNagiosReportState(service: string): string {
    enum CheckResultsState {
        OK          = 0,    // UP
        WARNING     = 1,    // UP or DOWN/UNREACHABLE*
        CRITICAL    = 2,    // DOWN/UNREACHABLE
        UNKNOWN     = 4     // DOWN/UNREACHABLE
    }

    // Determine state using errorCode as we do know the error level
    let state: string

    if (errors[service] === undefined) {
        state = CheckResultsState.WARNING.toString()
    } else {
        switch (errors[service]["Color"]) {
            case '00FF00': // Green
                state = CheckResultsState.OK.toString()
                break
            case 'FFFF00': // Yellow
                state = CheckResultsState.WARNING.toString()
                break
            case '990000': // Other red
            case 'FF0000': // Red
                state = CheckResultsState.CRITICAL.toString()
                break
            default:
                state = CheckResultsState.UNKNOWN.toString()
                break
        }
    }

    return state
}

async function GetDistributor(monitorSettingsService: MonitorSettingsService) {
    const distributorID = jwtDecode(monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributorid'];
    const monitorSettings = await monitorSettingsService.getMonitorSettings();

    const distributor = {
        InternalID: distributorID,
        Name: monitorSettings.Name,
        MachineAndPort: monitorSettings.MachineAndPort,
        MonitorLevel: monitorSettings.MonitorLevel
    };

    try {
        let distributorData = await monitorSettingsService.papiClient.get('/distributor');
        distributor.Name = distributorData.Name;
        const machineData = await monitorSettingsService.papiClient.get('/distributor/machine');
        distributor.MachineAndPort = machineData.Machine + ":" + machineData.Port;
        return distributor;
    }
    catch (_) {
        return distributor;
    }
}

function GetDistributorCache(monitorSettingsService: MonitorSettingsService, monitorSettings) {
    const distributorID = jwtDecode(monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributorid'];
    const distributor = {
        InternalID: distributorID,
        Name: monitorSettings.Name,
        MachineAndPort: monitorSettings.MachineAndPort,
        MonitorLevel: monitorSettings.MonitorLevel
    };

    return distributor;
}

async function UpdateMonitorSettingsSyncFailed(monitorSettingsService: MonitorSettingsService, distributor, status) {
    const monitorSettings = await monitorSettingsService.getMonitorSettings();
    monitorSettings.SyncFailed.Status = status;
    monitorSettings.Name = distributor.Name;
    monitorSettings.MachineAndPort = distributor.MachineAndPort;

    if (!status) {
        monitorSettings.SyncFailed.ErrorCounter = monitorSettings.SyncFailed.ErrorCounter + 1;
    }

    const settingsResponse = await monitorSettingsService.setMonitorSettings(monitorSettings);
}

export async function StatusUpdate(systemHealthBody, client, monitorSettingsService, lastStatus, success, errorCode, innerMessage = "", monitorSettings = {}) {
    let errorMessage = '';
    let distributor;
    const statusChanged = lastStatus ? !success : success; // xor (true, false) -> true
    distributor = await GetDistributorCache(monitorSettingsService, monitorSettings);

    if(lastStatus !== success || success === false){ // report to system health only in case of status change or in case of an error
        console.log(`sync status- ${success}, about to report to the relevant channel.`)
        await UpdateMonitorSettingsSyncFailed(monitorSettingsService, distributor, success);
        errorMessage = await systemHealthReportError(systemHealthBody, client, monitorSettingsService, distributor, errorCode, "SYNC-FAILED", innerMessage);

    } else if (!success || statusChanged) {
        await UpdateMonitorSettingsSyncFailed(monitorSettingsService, distributor, success);
    }

    return errorMessage;
}

async function systemHealthReportError(systemHealthBody, client: Client, monitorSettingsService: MonitorSettingsService, distributor, errorCode, type, innerMessage, generalErrorMessage = ""){
    if(systemHealthBody.Status != "" && systemHealthBody.Message != ""){
        const headers = {
            "X-Pepperi-OwnerID" : client.AddonUUID,
            "X-Pepperi-SecretKey" : client.AddonSecretKey
        }
    
        const body = {
            Name: "Sync",
            Description: "Sync status",
            Status: systemHealthBody.Status.toUpperCase(),
            Message: systemHealthBody.Message,
            BroadcastChannel: ['System', 'Tenant']
        }

        try{
            const Url: string = `/system_health/notifications`;
            console.log("callling system health notifications with body:" + JSON.stringify(body))
            const res = await monitorSettingsService.papiClient.post(Url, body, headers);
            console.log("Succeeded calling system health notifications")
        } catch(err){
            console.error(`Failed calling system health notifications, error: ${err}`);
        }
        
    }
     //construct error message
     const errorMessage = await ReportErrorCloudWatch(distributor, errorCode, type, innerMessage, generalErrorMessage);
     return errorMessage;
}

async function UpdateCodeJobCronExpression(papiClient, codeJob, updatedCronExpression) {
    const response = await papiClient.codeJobs.upsert({
        UUID: codeJob.UUID,
        CronExpression: updatedCronExpression,
        IsScheduled: true
    });

    return response;
}

async function GetCronExpression(token, maintenanceWindowHour, minutes = true, hours = false, interval = 5, dailyTime = 6) {
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

//#endregion