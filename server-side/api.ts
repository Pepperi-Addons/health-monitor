import MyService from './my.service'
import { Client, Request } from '@pepperi-addons/debug-server'
import { PapiClient, CodeJob } from "@pepperi-addons/papi-sdk";
import jwtDecode from "jwt-decode";
import fetch from "node-fetch";

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};
const errors = {
    "SUCCESS":{"Message":'SyncFailed test succeeded', "Color":"00FF00"},
    "JOB-EXECUTION-REPORT":{"Message":'JobExecutionFailed test finished', "Color":"990000"},
    "JOB-LIMIT-SUCCESS":{"Message":'JobLimitReached test finished', "Color":"00FF00"},
    "TEST-MESSAGE":{"Message":'test message', "Color":"00FF00"},
    "UNKNOWN-ERROR":{"Message":'Unknown error occured, contact rnd to fix this', "Color":"990000"},
    "GET-UDT-FAILED":{"Message":'Get udt failed, Pls confirm NUC is not available and recycle if needed', "Color":"FF0000"},
    "GET-ADAL-FAILED":{"Message":'Get adal by key failed, Pls confirm NUC is not available and recycle if needed', "Color":"FF0000"},
    "SYNC-UPDATE-FAILED":{"Message":'Sync status is done but Values field on map data have not been updated, Pls confirm NUC is not available and recycle if needed', "Color":"FF0000"},
    "SYNC-FAILED":{"Message":'Sync response status is Failed, Pls confirm NUC is not available and recycle if needed', "Color":"FF0000"},
    "SYNC-CALL-FAILED":{"Message":'Sync api call Failed, Pls confirm NUC is not available and recycle if needed', "Color":"FF0000"},
    "PASSED-ADDON-LIMIT":{"Message":'Distributor passed the addon limit', "Color":"FF0000"},
    "PASSED-JOB-LIMIT":{"Message":'Distributor passed the job limit', "Color":"FF0000"},
    "TIMEOUT-GET-UDT":{"Message":'Get udt call timeout', "Color":"FF0000"},
    "TIMEOUT-SYNC":{"Message":'Sync call timeout', "Color":"FF0000"},
    "TIMEOUT-SYNC-FAILED-TEST":{"Message":'sync_failed test got timeout', "Color":"FF0000"}
};

//#region health monitor api
export async function sync_failed(client: Client, request: Request) {
    console.log('HealthMonitorAddon start SyncFailed test');
    client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
    const service = new MyService(client);
    let errorCode = '';
    let success = false;
    let errorMessage ='';
    let lastStatus;
    let monitorSettings = {};

    try{
        monitorSettings = await service.getMonitorSettings();
    }
    catch (err){
        await StatusUpdate(service, false, false, 'GET-ADAL-FAILED')
    }

    let timeout = setTimeout(async function() { 
        //return 'TIMEOUT-GET-UDT';
        await StatusUpdate(service, false, false, 'TIMEOUT-SYNC-FAILED-TEST', '', monitorSettings);
        },270000); //4.5 minutes

    try {
        // validate before starting the test
        lastStatus = monitorSettings['SyncFailed']? monitorSettings['SyncFailed'].Status : false;
        if (request.body==null || !request.body.RunNow){
            if (lastStatus){
                const passedValidation = await validateBeforeTest(service, monitorSettings);
                if (!passedValidation){
                    return {
                        success: true,
                        errorMessage: "Do not run test"
                    };
                }
            }
        }

        errorCode = await SyncFailedTest(service, monitorSettings);

        if (errorCode=='SUCCESS'){
            success = true;
        }
        errorMessage = await StatusUpdate(service, lastStatus, success, errorCode,'', monitorSettings);
    }
    catch (err) {
        clearTimeout(timeout);
        success = false;
        const innerError = ('stack' in err) ? err.stack : 'Unknown Error Occured';
        errorMessage = await StatusUpdate(service, false, success, 'UNKNOWN-ERROR',innerError, monitorSettings);
    }
    finally{
        clearTimeout(timeout);
    }

    return {
        success: success,
        errorMessage: errorMessage
    };
};

export async function job_limit_reached(client: Client, request: Request) {
    console.log('HealthMonitorAddon start JobLimitReached test');
    try {
        client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
        const service = new MyService(client);
        const jobLimit = await JobLimitReachedTest(service);
        return jobLimit;
    }
    catch (err) {
        return {
            Success: false,
            ErrorMessage: ('message' in err) ? err.message : 'Unknown Error Occured',
        }
    }

};

export async function addon_limit_reached(client: Client, request: Request) {
    console.log('HealthMonitorAddon start AddonLimitReached test');
    try {
        client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
        const service = new MyService(client);
        const checkAddonsExecutionLimit = await AddonLimitReachedTest(service);
        return checkAddonsExecutionLimit;
    }
    catch (err) {
        return {
            Success: false,
            ErrorMessage: ('message' in err) ? err.message : 'Unknown Error Occured',
        }
    }
};

export async function job_execution_failed(client: Client, request: Request) {
    console.log('HealthMonitorAddon start jobExecutionFailed test');

    try {
        client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
        const service = new MyService(client);
        const jobExecution = await JobExecutionFailedTest(service);
        return jobExecution;
    }
    catch (error){
        const errorMessage = ('stack' in error) ? error.stack : 'Unknown Error Occured';
        return {
            success:false, 
            errorMessage:errorMessage
        };
    }
};

export async function health_monitor_settings(client: Client, request: Request){
    client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
    const service = new MyService(client);

    let monitorSettings = await service.getMonitorSettings();
    delete monitorSettings.SyncFailed.Status;
    delete monitorSettings.SyncFailed.ErrorCounter;

    monitorSettings.SyncFailed.ID='SYNC-FAILED';
    monitorSettings.JobLimitReached.ID='JOB-LIMIT-REACHED';
    monitorSettings.JobExecutionFailed.ID='JOB-EXECUTION-FAILED';

    return [
        monitorSettings.SyncFailed,
        monitorSettings.JobLimitReached,
        monitorSettings.JobExecutionFailed
    ]
};

export async function health_monitor_type_alert_edit(client: Client, request: Request){
    let codeJob;
    let typeData;
    //let dailyCheckTime;

    try {
        const service = new MyService(client);
        let monitorSettings = await service.getMonitorSettings();

        switch (request.body.Type){
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
            "Email":typeData.Email,
            "Webhook":typeData.Webhook,
            //"DailyCheckTime":dailyCheckTime,
            "Interval":typeData.Interval
        }
    }
    catch(error){
        const errorMessage = ('stack' in error) ? error.stack : 'Unknown Error Occured';
        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    } 
};

export async function health_monitor_type_alert_save(client: Client, request: Request){
    let codeJob;
    let lastInterval;
    //let dailyCheckTime;

    try {
        const papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID
        });

        const service = new MyService(client);
        let monitorSettings = await service.getMonitorSettings();
        
        switch (request.body.Type){
            case "SYNC-FAILED":
                codeJob = await service.papiClient.get('/code_jobs/'+monitorSettings.SyncFailedCodeJobUUID);
                monitorSettings.SyncFailed.Webhook = request.body.Webhook;
                //monitorSettings.SyncFailed.Email = request.body.Email;
                lastInterval = monitorSettings.SyncFailed.Interval;
                monitorSettings.SyncFailed.Interval = request.body.Interval;
                break;
            case "JOB-LIMIT-REACHED":
                codeJob = await service.papiClient.get('/code_jobs/'+monitorSettings.JobLimitReachedCodeJobUUID);
                monitorSettings.JobLimitReached.Webhook = request.body.Webhook;
                //monitorSettings.JobLimitReached.Email = request.body.Email;
                lastInterval = monitorSettings.JobLimitReached.Interval;
                monitorSettings.JobLimitReached.Interval = request.body.Interval;
                break;
            case "JOB-EXECUTION-FAILED":
                codeJob = await service.papiClient.get('/code_jobs/'+monitorSettings.JobExecutionFailedCodeJobUUID);
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
            const seconds = request.body.Interval/1000;
            const minutes = seconds/60;
            const hours = minutes/60;
            let updatedCronExpression;
            const maintenance = await papiClient.metaData.flags.name('Maintenance').get();
            const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);
    
            if (hours>1){
                updatedCronExpression = await GetCronExpression(client.OAuthAccessToken, maintenanceWindowHour, false, true, hours); // based on the choise on the UI
            }
            else{
                updatedCronExpression = await GetCronExpression(client.OAuthAccessToken, maintenanceWindowHour, true, false, minutes ); // based on the choise on the UI
            }
            
            const codeJobResponse = await UpdateCodeJobCronExpression(papiClient, codeJob, updatedCronExpression);
        }
    
        const settingsResponse = await service.setMonitorSettings(monitorSettings);

        return{
            Success: true,
            resultObject: "Update finished",
        }
    }
    catch (error){
        const errorMessage = ('stack' in error) ? error.stack : 'Unknown Error Occured';
        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }
};

export async function health_monitor_dashboard(client: Client, request: Request){
    const result = {
        LastSync:{},
        JobTimeUsage:{},
        PendingActions:{},
        SyncStatus:{},
        DailySync:{},
        Alerts:{}
    };

    try {
        const service = new MyService(client);

        const lastSyncResult = await service.papiClient.get("/audit_logs?fields=Status.ID,ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName ='sync'&page_size=1&order_by=ModificationDateTime desc");
        const lastSyncTime = new Date(lastSyncResult[0]["ModificationDateTime"]);
        const time = lastSyncTime.toTimeString().split(" ")[0]; 
        result.LastSync = {Time:time, Status:lastSyncResult[0]["Status.ID"]};
    
        const lastDay = new Date(Date.now() - 86400 * 1000);
        const firstHour = lastDay.getHours();
        let labelArray = new Array();

        const listPromises: Promise<any>[] = [];
        let i = 0;
        let lowerRange = new Date(lastDay.setMinutes(0));
        let upperRange = new Date(Date.parse(lowerRange.toISOString()) + 60*60*1000);
        for (i=0; i<=24; i++){
            const hour = ((firstHour+i)%24).toString();
            labelArray.push(hour);
            listPromises.push(service.papiClient.get("/audit_logs?fields=ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName='sync' and Status.ID=1 and ModificationDateTime between '"+lowerRange.toISOString()+"' And '"+upperRange.toISOString()+"'&page_size=1000&order_by=ModificationDateTime asc")); //success
            listPromises.push(service.papiClient.get("/audit_logs?fields=ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName='sync' and (Status.ID=0 or (Status.ID>1 and AuditInfo.JobMessageData.NumberOfTry>2)) and ModificationDateTime between '"+lowerRange.toISOString()+"' And '"+upperRange.toISOString()+"'&page_size=1000&order_by=ModificationDateTime asc")); //failure
            lowerRange = new Date(Date.parse(lowerRange.toISOString()) + 60*60*1000);
            upperRange = new Date(Date.parse(upperRange.toISOString()) + 60*60*1000);
        }

        //fix UI of labels
        for (var j in labelArray){
            if (labelArray[j].length==1){
                labelArray[j]= "0"+labelArray[j]+":00"
            }
            else{
                labelArray[j]= labelArray[j]+":00"
            }
        }

        await Promise.all(listPromises).then(
            function(res){
                let successCount = 0;
                let delayedCount = 0;
                let successArray = new Array();
                let delayedArray = new Array();
                i = 0;
                while (i<res.length){
                    successCount =successCount+ res[i].length;
                    delayedCount =delayedCount+ res[i+1].length;
                    successArray.push(res[i].length);
                    delayedArray.push(res[i+1].length);
                    i=i+2;
                }
                result.SyncStatus = {Success:successCount, Delayed:delayedCount};
                result.DailySync = {Labels: labelArray , Success: successArray, Delayed: delayedArray};
              }
        );
    
        const addons = await service.papiClient.get('/addons?page_size=-1');

        //there are logs stuck on in progress, maybe show one month back
        const lastWeek = new Date(Date.now()-  7*24*60*60*1000);
        const lastWeekString = lastWeek.toISOString();
        const pendingActionsResult = await service.papiClient.get("/audit_logs?fields=UUID,CreationDateTime,AuditInfo.JobMessageData.FunctionName,Event.User.Email,AuditInfo.JobMessageData.NumberOfTry,AuditInfo.JobMessageData.NumberOfTries,AuditInfo.JobMessageData.AddonData.AddonUUID,Status.Name&where=Status.ID!=0 and Status.ID!=1 and CreationDateTime>'"+lastWeekString+"'&page_size=1000&order_by=CreationDateTime desc");
        let pendingActionsValidateResult = new Array();
        for (var j in pendingActionsResult){
            if (pendingActionsResult[j]["AuditInfo.JobMessageData.FunctionName"]==undefined || pendingActionsResult[j]["AuditInfo.JobMessageData.AddonData.AddonUUID"]==undefined){
                continue;
            }
            let addonUUID =pendingActionsResult[j]["AuditInfo.JobMessageData.AddonData.AddonUUID"];            

            //prepare the data format for the UI
            if (addons.filter(x=> x.UUID==addonUUID).length==1){
                if (addons.filter(x=> x.UUID==addonUUID)[0].Name=='HealthMonitor'){
                    continue;
                }
                pendingActionsResult[j]["AuditInfo.JobMessageData.AddonData.AddonUUID"] = addons.filter(x=> x.UUID==addonUUID)[0].Name;
            }
            else{
                continue;
            }

            let email = pendingActionsResult[j]["Event.User.Email"].toString();
            if (email.startsWith("SupportAdminUser")){
                pendingActionsResult[j]["Event.User.Email"] = "Pepperi Admin";
            }
            pendingActionsResult[j]["CreationDateTime"] = new Date(pendingActionsResult[j]["CreationDateTime"]).toLocaleString();

            pendingActionsResult[j]["AuditInfo.JobMessageData.NumberOfTry"] = pendingActionsResult[j]["AuditInfo.JobMessageData.NumberOfTry"]+"/"+pendingActionsResult[j]["AuditInfo.JobMessageData.NumberOfTries"];
            pendingActionsValidateResult.push(pendingActionsResult[j]);
        }
        result.PendingActions = {Count: pendingActionsValidateResult.length, List: JSON.stringify(pendingActionsValidateResult)};
    
        const jobTimeUsageResult = await service.papiClient.get('/code_jobs/execution_budget');
        if ((jobTimeUsageResult.UsedBudget +jobTimeUsageResult.FreeBudget)==0){
            result.JobTimeUsage = {Percantage: 100 };
        }
        else{
            const currentPercantage = parseFloat(((jobTimeUsageResult.UsedBudget/(jobTimeUsageResult.UsedBudget +jobTimeUsageResult.FreeBudget))*100).toFixed(2));
            result.JobTimeUsage = {Percantage: currentPercantage };
        }
    
        return result;
    }
    catch (error){
        const errorMessage = ('stack' in error) ? error.stack : 'Unknown Error Occured';
        return {
            Success: false,
            ErrorMessage: errorMessage,
        }
    }

};

export async function run_now(client: Client, request: Request){
    let result;
    let message;

    switch (request.body.Type){
        case "SYNC-FAILED":
            request.body.RunNow = true;
            result = await sync_failed(client, request);
            if (result.success){
                message = "Sync is successful";
            }
            else{
                message = "Sync failed";
            }
            break;
        case "JOB-LIMIT-REACHED":
            result = await job_limit_reached(client, request);
            message = "Job usage is " + result.jobUsage + "%."
            break;
        case "JOB-EXECUTION-FAILED":
            result = await job_execution_failed(client, request);
            message = result.resultObject;
            break;
        default:
            message = "This run now test type does not exist.";
    }

    return message;

};

export async function send_test_message(client: Client, request: Request){
    try{
        const service = new MyService(client);
        ReportErrorWebhook(service, 'TEST-MESSAGE', request.body.Type);

        return "Webhook sent"
    }
    catch(error){
        const errorMessage = ('stack' in error) ? error.stack : 'Unknown Error Occured';
        return "Error: "+errorMessage
    }
};

//#endregion

//#region health monitor tests
export async function SyncFailedTest(service, monitorSettings) {
    let udtResponse;
    let syncResponse;
    let statusResponse;
    let object;
    let timeout;
    let start;
    let end;

    const addonData = await service.getMonitorSettings();
    let mapDataID = addonData.SyncFailed.MapDataID;

    //first udt
    try{ 
        console.log('HealthMonitorAddon, SyncFailedTest start first GET udt');
        timeout = setTimeout(async function() { 
            //return 'TIMEOUT-GET-UDT';
            await StatusUpdate(service, false, false, 'TIMEOUT-GET-UDT', '', monitorSettings);
            },30000);
        start = Date.now();
        udtResponse = await service.papiClient.get('/user_defined_tables/' + mapDataID);
        end = Date.now();
        clearTimeout(timeout);
        console.log('HealthMonitorAddon, SyncFailedTest finish first GET udt took '+(end-start)+' milliseconds',);
    }
    catch (error){
        return 'GET-UDT-FAILED';
    }
    finally{
        clearTimeout(timeout);
    }

    //update values field
    const count = (parseInt(udtResponse.Values[0]) + 1).toString();
    udtResponse.Values[0] = count;

    const LocalData = {
        "jsonBody": {
            "122": {
                "Headers": [
                    "WrntyID",
                    "MapDataExternalID",
                    "Values"
                ],
                "Lines": [
                    [
                        udtResponse.InternalID,
                        udtResponse.MapDataExternalID,
                        udtResponse.Values
                    ]
                ]
            }
        }
    };
    //do sync
    const body = {
        "LocalDataUpdates": LocalData,
        "LastSyncDateTime": 93737011100000,
        "DeviceExternalID": "QASyncTest",
        "CPIVersion": "16.50",
        "TimeZoneDiff": 0,
        "Locale": "",
        "BrandedAppID": "",
        "UserFullName": "",
        "SoftwareVersion": "",
        "SourceType": "10",
        "DeviceModel": "",
        "DeviceName": "",
        "DeviceScreenSize": "",
        "SystemName": "QA-PC",
        "ClientDBUUID": Math.floor(Math.random() * 1000000000).toString()
    };

    //sync
    try{
        console.log('HealthMonitorAddon, SyncFailedTest start POST sync');
        timeout = setTimeout(async function() { 
            //return 'TIMEOUT-SYNC';
            await StatusUpdate(service, false, false, 'TIMEOUT-SYNC','',monitorSettings);
            },120000);
        start = Date.now();
        syncResponse = await service.papiClient.post('/application/sync', body);

        const syncJobUUID = syncResponse.SyncJobUUID;
        //check if the values field have been updated
        statusResponse = await service.papiClient.get('/application/sync/jobinfo/' + syncJobUUID);
        while (statusResponse.Status == 'SyncStart' || statusResponse.Status == 'New' || statusResponse.Status == 'PutInProgress' ||statusResponse.Status == 'GetInProgress') {
            await sleep(2000);
            statusResponse = await service.papiClient.get('/application/sync/jobinfo/' + syncJobUUID);
        }
        end = Date.now();
        clearTimeout(timeout);
        console.log('HealthMonitorAddon, SyncFailedTest finish POST sync took '+(end-start)+' milliseconds');
    }
    catch(error){
        return 'SYNC-CALL-FAILED';
    }
    finally{
        clearTimeout(timeout);
    }
    
    if (statusResponse.Status == 'Done') {
        //second udt
        try{
            console.log('HealthMonitorAddon, SyncFailedTest start second GET udt');
            timeout = setTimeout(async function() { 
                //return 'TIMEOUT-GET-UDT';
                await StatusUpdate(service, false, false, 'TIMEOUT-GET-UDT','',monitorSettings);
                },30000);
            start = Date.now();
            udtResponse = await service.papiClient.get('/user_defined_tables/' + mapDataID);
            end = Date.now();
            clearTimeout(timeout);
            console.log('HealthMonitorAddon, SyncFailedTest finish second GET udt took '+(end-start)+' milliseconds');
        }
        catch(error){
            return 'GET-UDT-FAILED';
        }
        finally{
            clearTimeout(timeout);
        }
        
        if (udtResponse.Values[0] == count) {
            return 'SUCCESS';
        }
        else {
            return 'SYNC-UPDATE-FAILED';
        }
    }
    else {
        return 'SYNC-FAILED';
    }
};

export async function AddonLimitReachedTest(service) {
    console.log("HealthMonitorAddon, AddonLimitReachedTest start check addons execution limit");
    try {
        var resultItems = { PassedLimitItems: new Array(), NotPassedLimitItems: new Array() };
        console.log("AddonLimitReachedTest: send post request to /addons/code_jobs_limits");
        const result = await service.papiClient.post(`/addons/code_jobs_limits`);
        console.log("AddonLimitReachedTest: number of items return from function = " + Object.keys(result).length);
        if(result != null && Object.keys(result).length > 0){
            for (var item in result) {
                if(result[item].IsPassedTheLimit != null && result[item].IsPassedTheLimit == true){
                    const innerMessage = "AddonUUID "+item + " reached the limit - " + result[item].PercentageFromLimit;
                    ReportError(service, await GetDistributor(service), "PASSED-ADDON-LIMIT", "ADDON-LIMIT-REACHED", innerMessage );
                    resultItems["PassedLimitItems"].push(item);
                }
                else if(result[item].IsPassedTheLimit != null && result[item].IsPassedTheLimit == false){
                    resultItems["NotPassedLimitItems"].push(item);
                }
            }
        }
        
        console.log("HealthMonitorAddon, AddonLimitReachedTest finish check addons execution limit");
        console.log(JSON.stringify(resultItems));
        return {
            success:true, 
            resultObject:resultItems
        };
    }
    catch (err) {
        return {
            Success: false,
            ErrorMessage: ('message' in err) ? err.message : 'Unknown Error Occured',
        }
    }
};

export async function JobLimitReachedTest(service) {
    console.log("HealthMonitorAddon, JobLimitReachedTest start check execution budget limit");
    let lastPercantage;
    let currentPercantage;
    let innerMessage;
    let reportSent = false;

    try {
        console.log("JobLimitReachedTest: send get request to code_jobs/execution_budget");
        const result = await service.papiClient.get('/code_jobs/execution_budget');
        let monitorSettings = await service.getMonitorSettings();
        lastPercantage = monitorSettings.JobLimitReached.LastPercantage;

        currentPercantage = parseFloat(((result.UsedBudget/(result.UsedBudget +result.FreeBudget))*100).toFixed(2));
        innerMessage ="You have reached " + currentPercantage +"% of your job limits.";

        if (currentPercantage>=80 && currentPercantage<90){
            if (lastPercantage<80){
                ReportError(service, await GetDistributorCache(service, monitorSettings), "PASSED-JOB-LIMIT", "JOB-LIMIT-REACHED", innerMessage );
                reportSent = true;
            }
        }
        else if (currentPercantage>=90 && currentPercantage<95){
            if (lastPercantage<90){
                ReportError(service, await GetDistributorCache(service, monitorSettings), "PASSED-JOB-LIMIT", "JOB-LIMIT-REACHED", innerMessage );
                reportSent = true;
            }
        }
        else if (currentPercantage>=95){
            if (lastPercantage<95){
                ReportError(service, await GetDistributorCache(service, monitorSettings), "PASSED-JOB-LIMIT", "JOB-LIMIT-REACHED", innerMessage );
                reportSent = true;
            }
        }

        if (!reportSent){
            ReportErrorCloudWatch(await GetDistributorCache(service, monitorSettings), "JOB-LIMIT-SUCCESS", "JOB-LIMIT-REACHED", innerMessage );
        }

        console.log(innerMessage);
        monitorSettings.JobLimitReached.LastPercantage = currentPercantage;
        const settingsResponse = await service.setMonitorSettings(monitorSettings); 

        console.log("HealthMonitorAddon, JobLimitReachedTest finish check execution budget limit");
        return {
            success:true,
            jobUsage: currentPercantage,
            resultObject:innerMessage
        };
    }
    catch (err) {
        return {
            Success: false,
            ErrorMessage: ('message' in err) ? err.message : 'Unknown Error Occured',
        }
    }
};

export async function JobExecutionFailedTest(service) {
    console.log("HealthMonitorAddon, JobExecutionFailedTest start");
    let innerMessage;
    let report;

    try {
        let monitorSettings = await service.getMonitorSettings();
        const interval = monitorSettings.JobExecutionFailed.Interval;
        const intervalDate = new Date(Date.now() - interval).toISOString();
        const intervalUTCDate = new Date(Date.now() - interval).toUTCString();
        const auditLogsResult = await service.papiClient.get("/audit_logs?where=AuditInfo.JobMessageData.IsScheduled=true and Status.ID=0 and ModificationDateTime>'"+intervalDate+"' and AuditInfo.JobMessageData.FunctionName!='monitor' and AuditInfo.JobMessageData.FunctionName!='sync_failed'&order_by=ModificationDateTime desc");
        const addons = await service.papiClient.get('/addons?page_size=500');

        if (auditLogsResult.length==0){
            report= "No new errors were found since " + intervalUTCDate + ".";
            ReportErrorCloudWatch(await GetDistributorCache(service, monitorSettings), "JOB-EXECUTION-REPORT", "JOB-EXECUTION-FAILED", innerMessage);
            console.log("HealthMonitorAddon, JobExecutionFailedTest finish");
            return {
                success:true, 
                resultObject:report
            };
        }
        else {
            report = new Array();
            for (var auditLog in auditLogsResult) {
                if (auditLogsResult[auditLog].AuditInfo.JobMessageData.AddonData==undefined){
                    report.push({
                        "CreationDateTime":auditLogsResult[auditLog].CreationDateTime,
                        "CodeJobName":auditLogsResult[auditLog].AuditInfo.JobMessageData.CodeJobName,
                        "NumberOfTry":auditLogsResult[auditLog].AuditInfo.JobMessageData.NumberOfTry,
                        "NumberOfTries":auditLogsResult[auditLog].AuditInfo.JobMessageData.NumberOfTries,
                        "FunctionName": auditLogsResult[auditLog].AuditInfo.JobMessageData.FunctionName,
                        "ErrorMessage": auditLogsResult[auditLog].AuditInfo.ErrorMessage,
                    });
                }
                else{
                    const addonName = addons.filter(x=> x.UUID==auditLogsResult[auditLog].AuditInfo.JobMessageData.AddonData.AddonUUID)[0].Name;
                    report.push({
                        "CreationDateTime":auditLogsResult[auditLog].CreationDateTime,
                        "CodeJobName":auditLogsResult[auditLog].AuditInfo.JobMessageData.CodeJobName,
                        "NumberOfTry":auditLogsResult[auditLog].AuditInfo.JobMessageData.NumberOfTry,
                        "NumberOfTries":auditLogsResult[auditLog].AuditInfo.JobMessageData.NumberOfTries,
                        "AddonName": addonName, 
                        "FunctionName": auditLogsResult[auditLog].AuditInfo.JobMessageData.FunctionName,
                        "ErrorMessage": auditLogsResult[auditLog].AuditInfo.ErrorMessage,
                    });
                }
            }

            if (report.length==0){
                const reportMessage= "No new errors were found since " + intervalUTCDate + ".";
                ReportErrorCloudWatch(await GetDistributorCache(service, monitorSettings), "JOB-EXECUTION-REPORT", "JOB-EXECUTION-FAILED", innerMessage);
                console.log("HealthMonitorAddon, JobExecutionFailedTest finish");
                return {
                    success:true, 
                    resultObject:reportMessage
                };
            }

            innerMessage =JSON.stringify(report);
            ReportError(service, await GetDistributorCache(service, monitorSettings), "JOB-EXECUTION-REPORT", "JOB-EXECUTION-FAILED", innerMessage);
        }

        console.log("HealthMonitorAddon, JobExecutionFailedTest finish");
        return {
            success:false, 
            resultObject:JSON.stringify(report)
        };
    }
    catch (err) {
        return {
            Success: false,
            ErrorMessage: ('message' in err) ? err.message : 'Unknown Error Occured',
        }
    }
};


//#endregion

//#region private functions

async function validateBeforeTest(service, monitorSettings) {
    // check if monitor level is 4
    if (monitorSettings.MonitorLevel==4){
        return false;
    }

    // check if Nucleus is loaded
    const isDistributorLoaded = await service.papiClient.get("/distributor/InNucleus");
    if (!isDistributorLoaded){
        if (monitorSettings.MonitorLevel>2){
            console.log('This test dont run on monitor level 3 while distributor not loaded.');
            return false;
        }
    }

    //check if in the last 2 minutes were successful sync dont perform test
    const twoMinutesAgo = new Date(Date.now() - 150 * 1000).toISOString();
    const currentSync = await service.papiClient.get("/audit_logs?fields=ModificationDateTime&where=AuditInfo.JobMessageData.FunctionName='sync' and ModificationDateTime>'"+twoMinutesAgo+"' and Status.ID=1");
    if (currentSync.length>0){
        console.log('There was a successful sync at the last 150 seconds.');
        return false;
    }

    return true;
}

async function ReportError(service, distributor, errorCode, type, innerMessage="") {
    const environmant = jwtDecode(service.client.OAuthAccessToken)["pepperi.datacenter"];
    // report error to log
    const errorMessage = await ReportErrorCloudWatch(distributor, errorCode, type, innerMessage);

    // report error to teams on System Status chanel
    ReportErrorTeams(service, environmant, distributor, errorCode, type, innerMessage);

    // report error to webhook
    ReportErrorWebhook(service, errorCode, type, innerMessage);

    // report error to admin email
    //ReportErrorEmail(distributor, errorCode, type, innerMessage);

    return errorMessage;
}

async function ReportErrorCloudWatch(distributor, errorCode, type , innerMessage="") {
    let error = "";
    error = 'DistributorID: '+distributor.InternalID+'\n\rName: '+distributor.Name+'\n\rMachine and Port: '+distributor.MachineAndPort+'\n\rType: ' + type+ '\n\rCode: ' + errorCode + '\n\rMessage: '+ errors[errorCode]["Message"] + '\n\rInnerMessage: '+ innerMessage;

    if (errorCode=='SUCCESS')
        console.log(error);
    else
        console.error(error);
    return error;
}

/*export async function ReportErrorTeamsDriver(client: Client, request: Request){
    const service = new MyService(client);
    //const environmant = 'sandbox';//jwtDecode(service.client.OAuthAccessToken)["pepperi.datacenter"];
    const environmant = 'production';
    const distributor = await GetDistributor(service);
    const errorCode = "SYNC-CALL-FAILED";
    //const errorCode = "SUCCESS";
    const type = "JOB-EXECUTION-FAILED";
    const innerMessage = "Test by Amir F.";

    ReportErrorTeams(environmant, distributor, errorCode, type, innerMessage);
}*/

export async function ReportErrorTeamsDriver(client: Client, request: Request){
    const service = new MyService(client);
    const environmant = 'sandbox';//jwtDecode(service.client.OAuthAccessToken)["pepperi.datacenter"];
    //const environmant = 'production';
    const distributor = await GetDistributor(service);
    //const errorCode = "SYNC-CALL-FAILED";
    const errorCode = "SUCCESS";
    const type = "SYNC-FAILED";
    const innerMessage = "Test by Meital";

    ReportErrorTeams(service, environmant, distributor, errorCode, type, innerMessage);
}

async function ReportErrorTeams(service, environmant, distributor, errorCode, type, innerMessage="") {
    let url = '';
    let body = {
        themeColor: errors[errorCode]["Color"],
        Summary: distributor.InternalID + " - "+distributor.Name,
        sections: [{
            facts: [{
                name: "Distributor ID",
                value: distributor.InternalID
            },{
                name: "Name",
                value: distributor.Name
            },{
                name: "Machine and Port",
                value: distributor.MachineAndPort
            },{
                name: "Code",
                value: errorCode
            },{
                name: "Type",
                value: type
            }, {
                name: "Message",
                value: errors[errorCode]["Message"]
            }, {
                name: "Inner Message",
                value: innerMessage
            }],
            "markdown": true
        }],
    };
    let unite = false;
    let varUpdated = true;

    if (type == "SYNC-FAILED"){
        const alertBody = {
            DistributorID: distributor.InternalID,
            AlertCode: errorCode
        };
        try {
            const alertLogicResponse = await service.papiClient.post('/var/addons/health_monitor/alerts', alertBody);
            if (alertLogicResponse.Count>=5){
                unite = true;
                const alert = errorCode=='SUCCESS'? alertLogicResponse.Count%10==0 : new Date(alertLogicResponse.TopAlerts[0].Value).getMinutes() > new Date(alertLogicResponse.TopAlerts[1].Value).getMinutes();
                if (alert){
                    body = {
                        themeColor: errors[errorCode]["Color"]=="00FF00"? "FFFF00": errors[errorCode]["Color"],
                        Summary: `Errors on ${alertLogicResponse.Count} distributors`,
                        sections: [{
                            facts: [{
                                name: "Distributors",
                                value: alertLogicResponse.Count.toString()
                            },{
                                name: "Code",
                                value: alertLogicResponse.AlertCode
                            },{
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
                else{
                    return;
                }
            }
        }
        catch (err){
            varUpdated = false;
        }
    }

    // Changed urls to use new configuration for Teams.
    if (environmant=='sandbox'){
        if (errorCode=='SUCCESS') 
            if (unite) //yellow icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/cb540659239545cc8be681c2a51f8c7e/4361420b-8fde-48eb-b62a-0e34fec63f5c';
            else //green icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/a9e46257d73a40b39b563b77dc6abe6a/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        else{ // red icon
            url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/e5f4ab775d0147ecbb7f0f6bdf70aa0b/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        }
    }
    else{
        if (errorCode=='SUCCESS') 
            if (unite) //yellow icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/628bc029561b4d76875a2b5c0b48c58f/4361420b-8fde-48eb-b62a-0e34fec63f5c';
            else //green icon
                url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/400154cd59544fd583791a2f99641189/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        else{ // red icon
            url = 'https://wrnty.webhook.office.com/webhookb2/9da5da9c-4218-4c22-aed6-b5c8baebfdd5@2f2b54b7-0141-4ba7-8fcd-ab7d17a60547/IncomingWebhook/0db0e56f12044634937712db79f704e1/4361420b-8fde-48eb-b62a-0e34fec63f5c';
        }
    }

    var res = await fetch(url, {
        method: "POST", 
        body: JSON.stringify(body)
    });
}

async function ReportErrorWebhook(service, errorCode, type, innerMessage="") {
    //need to decide which errors the admin can get
    let url= "";
    let testType="";
    const monitorSettings = await service.getMonitorSettings();

    switch (type){
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

    if (innerMessage== ""){
        innerMessage =errors[errorCode]["Message"];
    }

    const body = { Summary: testType,
        sections: [{
            facts: [{
                name: "Date",
                value: new Date(Date.now()).toUTCString()
            },{
                name: "Type",
                value: testType
            },{
                name: "Message",
                value: innerMessage
            }],
            "markdown": true
        }],
    }

    if (url){
        var res = await fetch(url, {
            method: "POST", 
            body: JSON.stringify(body)
        });
    }
}

async function GetDistributor(service){
    const distributorID = jwtDecode(service.client.OAuthAccessToken)['pepperi.distributorid'];
    const monitorSettings = service.getMonitorSettings();
    const distributor ={
        InternalID: distributorID,
        Name: monitorSettings.Name,
        MachineAndPort: monitorSettings.MachineAndPort,
        MonitorLevel: monitorSettings.MonitorLevel
    };
    try{
        let distributorData = await service.papiClient.get('/distributor');
        distributor.Name = distributorData.Name;
        const machineData = await service.papiClient.get('/distributor/machine');
        distributor.MachineAndPort = machineData.Machine + ":" + machineData.Port;
        return distributor;
    }
    catch(err){
        return distributor;
    }
}

function GetDistributorCache(service, monitorSettings){
    const distributorID = jwtDecode(service.client.OAuthAccessToken)['pepperi.distributorid'];
    const distributor ={
        InternalID: distributorID,
        Name: monitorSettings.Name,
        MachineAndPort: monitorSettings.MachineAndPort,
        MonitorLevel: monitorSettings.MonitorLevel
    };
    return distributor;
}

async function UpdateMonitorSettingsSyncFailed(service, distributor, status) {
    const monitorSettings = await service.getMonitorSettings();
    monitorSettings.SyncFailed.Status = status;
    monitorSettings.Name = distributor.Name;
    monitorSettings.MachineAndPort = distributor.MachineAndPort;
    if (!status){
        monitorSettings.SyncFailed.ErrorCounter = monitorSettings.SyncFailed.ErrorCounter +1;
    }
    const settingsResponse = await service.setMonitorSettings(monitorSettings); 
}

async function StatusUpdate(service, lastStatus, success, errorCode, innerMessage="", monitorSettings={}){
    let errorMessage = '';
    let distributor;
    const statusChanged = lastStatus? !success: success; //xor (true, false) -> true 
    if (!success){ //write to channel 'System Status' if the test failed
        distributor = await GetDistributorCache(service, monitorSettings);
        errorMessage = await ReportError(service, distributor, errorCode, "SYNC-FAILED", innerMessage);
        await UpdateMonitorSettingsSyncFailed(service, distributor, success);
    }
    else if (statusChanged){ //write to channel 'System Status' on the first time when test changes from fail to success
        distributor = await GetDistributorCache(service, monitorSettings);
        errorMessage = await ReportError(service, distributor, errorCode, "SYNC-FAILED", innerMessage);
        await UpdateMonitorSettingsSyncFailed(service, distributor, success);
    }
    else{
        distributor = GetDistributorCache(service, monitorSettings);
        errorMessage = await ReportErrorCloudWatch(distributor, errorCode, "SYNC-FAILED", innerMessage);
    }
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

async function GetCronExpression(token, maintenanceWindowHour, minutes=true, hours=false, interval=5, dailyTime=6) {
    let minute;
    let hour;

    if (minutes){
        // rand is integet between 0-{value-1} included.
        const rand = (jwtDecode(token)['pepperi.distributorid'])%interval;
        minute = rand +"-59/"+interval;
        switch(maintenanceWindowHour) {
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
                hour = "0-"+(maintenanceWindowHour-2)+','+(maintenanceWindowHour+2)+"-23";
        }
    }
    else if (hours){
        // rand is integet between 0-59 included.
        const rand = (jwtDecode(token)['pepperi.distributorid'])%60;
        minute = rand +"-59/60";
        
        let i = dailyTime;
        while (i>=interval){
            i=i-interval;
        }
        hour =i.toString();
        i=i+interval;
        while (i<24){
            hour = hour + "," +i;
            i=i+interval;
        }
    }
    return minute + " " + hour +" * * *";
}

//#endregion