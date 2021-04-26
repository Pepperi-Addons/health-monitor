
/*
The return object format MUST contain the field 'success':
{success:true}

If the result of your code is 'false' then return:
{success:false, errorMessage:{the reason why it is false}}
The erroeMessage is importent! it will be written in the audit log and help the user to understand what happen
*/
import { PapiClient, CodeJob, AddonDataScheme } from "@pepperi-addons/papi-sdk";
import { Client, Request } from '@pepperi-addons/debug-server'
import jwtDecode from "jwt-decode";

exports.install = async (client: Client, request: Request) => {
    try {
        let success = true;
        let errorMessage = '';
        let resultObject = {};
        let successSyncFailed = true;
        let successJobLimitReached = true;
        let successJobExecutionFailed = true;
        let successAddonLimitReached = true;
        let successDailyAddonUsage = true

        const papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID
        });

        // install SyncFailed test
        let retValSyncFailed = await InstallSyncFailed(client, papiClient);
        successSyncFailed = retValSyncFailed.success;
        errorMessage = "SyncFailed Test installation failed on: " + retValSyncFailed.errorMessage;
        if (!successSyncFailed){
            console.error(errorMessage);
            return retValSyncFailed;
        }
        let mapDataID=retValSyncFailed["mapDataID"];
        console.log('SyncFailed codejob installed succeeded.');

        // install JobLimitReached test
        let retValJobLimitReached = await InstallJobLimitReached(client, papiClient);
        successJobLimitReached = retValJobLimitReached.success;
        errorMessage = "JobLimitReached Test installation failed on: " + retValJobLimitReached.errorMessage;
        if (!successJobLimitReached){
            console.error(errorMessage);
            return retValJobLimitReached;
        }
        console.log('JobLimitReached codejob installed succeeded.');

        // install JobExecutionFailed test
        let retValJobExecutionFailed = await InstallJobExecutionFailed(client, papiClient);
        successJobExecutionFailed = retValJobExecutionFailed.success;
        errorMessage = "JobExecutionFailed Test installation failed on: " + retValJobExecutionFailed.errorMessage;
        if (!successJobExecutionFailed){
            console.error(errorMessage);
            return retValJobExecutionFailed;
        }
        console.log('JobExecutionFailed codejob installed succeeded.');

        // install DailyAddonUsage codejob
        let retValDailyAddonUsage = await InstallDailyAddonUsage(client, papiClient);
        successDailyAddonUsage = retValDailyAddonUsage.success;
        errorMessage = "DailyAddonUsage codejob installation failed on: " + retValDailyAddonUsage.errorMessage;
        if (!successDailyAddonUsage){
            console.error(errorMessage);
            return retValDailyAddonUsage;
        }
        console.log('DailyAddonUsage codejob installed succeeded.');
        
        
        // add all needed default data to the additinal data
        let addon = await papiClient.addons.installedAddons.addonUUID(client.AddonUUID).get();
        let data = addon.AdditionalData? JSON.parse(addon.AdditionalData):{};
        const distributor = await GetDistributor(papiClient);
        data.Name = distributor.Name;
        data.MachineAndPort = distributor.MachineAndPort;
        data.SyncFailed = { Type:"Sync failed", Status: true, ErrorCounter:0, MapDataID:mapDataID, Email:"", Webhook:"",Interval:5*60*1000 };
        data.JobLimitReached = {Type:"Job limit reached", LastPercantage:0, Email:"", Webhook:"",Interval:24*60*60*1000};
        data.JobExecutionFailed = {Type:"Job execution failed", Email:"", Webhook:"",Interval:24*60*60*1000};

        addon.AdditionalData = JSON.stringify(data);
        await papiClient.addons.installedAddons.upsert(addon);

        console.log('HealthMonitorAddon installed succeeded.');
        return {
            success: success,
            errorMessage: errorMessage,
            resultObject: resultObject
        };    
    }
    catch (err) {
        return {
            success: false,
            errorMessage: ('message' in err) ? err.message : 'Cannot install HealthMonitorAddon. Unknown Error Occured',
        };
    }
};

exports.uninstall = async (client: Client, request: Request) => {
    try {
        const papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID
        });

        // unschedule SyncFailed test
        let syncFailedCodeJobUUID = await GetCodeJobUUID(papiClient, client.AddonUUID, 'SyncFailedCodeJobUUID');
        if(syncFailedCodeJobUUID != '') {
            await papiClient.codeJobs.upsert({
                UUID:syncFailedCodeJobUUID,
                CodeJobName: "SyncFailed Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('SyncFailed codejob unschedule succeeded.');

        // unschedule JobLimitReached test
        let jobLimitReachedCodeJobUUID = await GetCodeJobUUID(papiClient, client.AddonUUID, 'JobLimitReachedCodeJobUUID');
        if(jobLimitReachedCodeJobUUID != '') {
            await papiClient.codeJobs.upsert({
                UUID:jobLimitReachedCodeJobUUID,
                CodeJobName: "JobLimitReached Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('JobLimitReached codejob unschedule succeeded.');

        // unschedule AddonLimitReached test
        let addonLimitReachedCodeJobUUID = await GetCodeJobUUID(papiClient, client.AddonUUID, 'AddonLimitReachedCodeJobUUID');
        if(addonLimitReachedCodeJobUUID != '') {
            await papiClient.codeJobs.upsert({
                UUID:addonLimitReachedCodeJobUUID,
                CodeJobName: "AddonLimitReached Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('AddonLimitReached codejob unschedule succeeded.');

        // unschedule JobExecutionFailed test
        let jobExecutionFailedCodeJobUUID = await GetCodeJobUUID(papiClient, client.AddonUUID, 'JobExecutionFailedCodeJobUUID');
        if(jobExecutionFailedCodeJobUUID != '') {
            await papiClient.codeJobs.upsert({
                UUID:jobExecutionFailedCodeJobUUID,
                CodeJobName: "JobExecutionFailed Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('JobExecutionFailed codejob unschedule succeeded.');

        // unschedule DailyAddonUsage
        let dailyAddonUsageCodeJobUUID = await GetCodeJobUUID(papiClient, client.AddonUUID, 'DailyAddonUsageCodeJobUUID');
        if(dailyAddonUsageCodeJobUUID != '') {
            await papiClient.codeJobs.upsert({
                UUID:dailyAddonUsageCodeJobUUID,
                CodeJobName: "DailyAddonUsage",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        var headersADAL = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        }
        const responseDailyAddonUsageTable = await papiClient.post('/addons/data/schemes/DailyAddonUsage/purge',null, headersADAL);
        console.log('DailyAddonUsage codejob unschedule succeeded.');

        console.log('HealthMonitorAddon uninstalled succeeded.');
        return {
            success:true,
            errorMessage:'',
            resultObject:{}
        };
    }
    catch (err) {
        return {
            success: false,
            errorMessage: ('message' in err) ? err.message : 'Failed to delete codejobs of HealthMonitor Addon',
            resultObject: {}
        };
    }
};

exports.upgrade = async (client: Client, request: Request) => {
    let success = true;
    let errorMessage = '';
    let resultObject = {};

    const papiClient = new PapiClient({
        baseURL: client.BaseURL,
        token: client.OAuthAccessToken,
        addonUUID: client.AddonUUID
    });

    try {
        // add to AdditionalData data.SyncFailed.MapDataID - from version 1.0.56
        let addon = await papiClient.addons.installedAddons.addonUUID(client.AddonUUID).get();
        const additionalData = addon.AdditionalData? addon.AdditionalData : "";
        let data = JSON.parse(additionalData);
        if (!data.SyncFailed.MapDataID){
            const udtResponse = await papiClient.userDefinedTables.iter({ where: "MapDataExternalID='PepperiHealthMonitor'" }).toArray();
            data.SyncFailed.MapDataID = udtResponse[0].InternalID;
            addon.AdditionalData = JSON.stringify(data);
            const response = await papiClient.addons.installedAddons.upsert(addon);
        }
        
        /////////////////////////////////////////////////////////////////////
        // install DailyAddonUsage if not installed yet from version 1.0.58
        if (!data.DailyAddonUsageCodeJobUUID){
            // install DailyAddonUsage codejob
            let retValDailyAddonUsage = await InstallDailyAddonUsage(client, papiClient);
            let successDailyAddonUsage = retValDailyAddonUsage.success;
            errorMessage = "DailyAddonUsage codejob installation failed on: " + retValDailyAddonUsage.errorMessage;
            if (!successDailyAddonUsage){
                console.error(errorMessage);
                return retValDailyAddonUsage;
            }
            console.log('DailyAddonUsage codejob installed succeeded.');
        } 

        // unschedule AddonLimitReached test
        if (data.AddonLimitReachedCodeJobUUID){
            let addonLimitReachedCodeJobUUID = await GetCodeJobUUID(papiClient, client.AddonUUID, 'AddonLimitReachedCodeJobUUID');
            if(addonLimitReachedCodeJobUUID != '') {
                await papiClient.codeJobs.upsert({
                    UUID:addonLimitReachedCodeJobUUID,
                    CodeJobName: "AddonLimitReached Test",
                    IsScheduled: false,
                    CodeJobIsHidden:true
                });
            }
            delete data ['AddonLimitReachedCodeJobUUID'];
            addon.AdditionalData = JSON.stringify(data);
            const response = await papiClient.addons.installedAddons.upsert(addon);
            console.log('AddonLimitReached codejob unschedule succeeded.');
        }
        /////////////////////////////////////////////////////////////////////

        
        console.log('HealthMonitorAddon upgrade succeeded.');
        return {
            success: success,       
            resultObject: resultObject
        };
    }
    catch (err){
        return {
            success: false,
            errorMessage: ('message' in err) ? err.message : 'Failed to upgrade HealthMonitor Addon'
        };
    }
};

exports.downgrade = async (client: Client, request: Request) => {
    return {success:true,resultObject:{}};
};

//#region private functions

async function UpdateCodeJobUUID(papiClient, addonUUID, uuid, CodeJobTestName) {
    try {
        let addon = await papiClient.addons.installedAddons.addonUUID(addonUUID).get();
        console.log("installed addon object is: " + JSON.stringify(addon));
        const additionalData= addon? addon.AdditionalData : false;
        if(additionalData) {
            let data = JSON.parse(addon.AdditionalData);
            data[CodeJobTestName] = uuid;
            addon.AdditionalData = JSON.stringify(data);
        }
        else {
            console.log("could not recieved addon with ID: " + addonUUID);
            return {
                success: false,
                errorMessage: "Addon does not exists."
            };
        }
        console.log("addon object to post is: " + JSON.stringify(addon));
        await papiClient.addons.installedAddons.upsert(addon);
        return {
            success:true, 
            errorMessage:""
        };
    }
    catch (err) {
        return {
            success: false,
            errorMessage: ('message' in err) ? err.message : 'Unknown Error Occured',
        };
    }
}

async function GetCodeJobUUID(papiClient, addonUUID, CodeJobTestName) {
    let uuid = '';
    let addon = await papiClient.addons.installedAddons.addonUUID(addonUUID).get();
    const additionalData= addon? addon.AdditionalData : false;
    if(additionalData) {
        let data = JSON.parse(addon.AdditionalData);
        uuid = data[CodeJobTestName];
    }
    return uuid;
}

function GetMonitorCronExpression(token, maintenanceWindowHour){
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid'])%60;
    const minute = rand +"-59/60";
    let hour = '';

    // monitor will be disabled from 3 hours, starting one hour before maintenance window and finished one hour after
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

    return minute + " " + hour +" * * *";
}

function GetAddonLimitCronExpression(token){
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid'])%59;
    return rand +"-59/60 4 * * *";
}

function GetJobLimitCronExpression(token){
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid'])%59;
    return rand +"-59/60 6 * * *";
}

function GetJobExecutionCronExpression(token){
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid'])%59;
    return rand +"-59/60 8 * * *";
}

function GetDailyAddonUsageCronExpression(token){
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid'])%59;
    return rand +"-59/60 5 * * *";
}

async function InstallSyncFailed(client, papiClient){
    const mapDataMetaData ={
        TableID:"PepperiHealthMonitor",
        MainKeyType: {ID:0, Name:"Any"},
        SecondaryKeyType:{ID:0,Name:"Any"},
        Hidden : false,
        MemoryMode: {
            Dormant: false,
            Volatile: false
        }
    };
    const mapData ={
        MapDataExternalID:"PepperiHealthMonitor",
        MainKey:"MonitorSyncCounter",
        SecondaryKey:"",
        Values: ["0"]
    };

    const resultAddUDT = await papiClient.metaData.userDefinedTables.upsert(mapDataMetaData);
    const resultAddUDTRow = await papiClient.userDefinedTables.upsert(mapData);

    const maintenance = await papiClient.metaData.flags.name('Maintenance').get();
    const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);
    let codeJob = await CreateAddonCodeJob(client, papiClient, "SyncFailed Test", "SyncFailed Test for HealthMonitor Addon.", "api", "sync_failed", GetMonitorCronExpression(client.OAuthAccessToken, maintenanceWindowHour));
    let retVal = await UpdateCodeJobUUID(papiClient, client.AddonUUID, codeJob.UUID, 'SyncFailedCodeJobUUID');
    retVal["mapDataID"]=resultAddUDTRow.InternalID;
    return retVal;
}

async function InstallJobLimitReached(client, papiClient){
    let codeJob = await CreateAddonCodeJob(client, papiClient, "JobLimitReached Test", "JobLimitReached Test for HealthMonitor Addon. Check distributor not pass the addons execution limit.", "api", 
    "job_limit_reached", GetJobLimitCronExpression(client.OAuthAccessToken));
    let retVal = await UpdateCodeJobUUID(papiClient, client.AddonUUID, codeJob.UUID, 'JobLimitReachedCodeJobUUID');
    return retVal;
}

async function InstallAddonLimitReached(client, papiClient){
    let codeJob = await CreateAddonCodeJob(client, papiClient, "AddonLimitReached Test", "AddonLimitReached Test for HealthMonitor Addon. Check distributor not pass the addons execution limit.", "api", 
    "addon_limit_reached", GetAddonLimitCronExpression(client.OAuthAccessToken));
    let retVal = await UpdateCodeJobUUID(papiClient, client.AddonUUID, codeJob.UUID, 'AddonLimitReachedCodeJobUUID');
    return retVal;
}

async function InstallJobExecutionFailed(client, papiClient){
    let codeJob = await CreateAddonCodeJob(client, papiClient, "JobExecutionFailed Test", "JobExecutionFailed Test for HealthMonitor Addon.", "api", 
    "job_execution_failed", GetJobExecutionCronExpression(client.OAuthAccessToken));
    let retVal = await UpdateCodeJobUUID(papiClient, client.AddonUUID, codeJob.UUID, 'JobExecutionFailedCodeJobUUID');
    return retVal;
}

async function InstallDailyAddonUsage(client, papiClient){
    let codeJob = await CreateAddonCodeJob(client, papiClient, "DailyAddonUsage", "DailyAddonUsage for HealthMonitor Addon.", "addon-usage", 
    "daily_addon_usage", GetDailyAddonUsageCronExpression(client.OAuthAccessToken));
    let retVal = await UpdateCodeJobUUID(papiClient, client.AddonUUID, codeJob.UUID, 'DailyAddonUsageCodeJobUUID');
    
    // add table to ADAL
    const bodyDailyAddonUsageTable:AddonDataScheme = {
        Name: 'DailyAddonUsage',
        Type: 'meta_data'
    };
    const headersADAL = {
        "X-Pepperi-OwnerID": client.AddonUUID,
        "X-Pepperi-SecretKey": client.AddonSecretKey
    }
    const responseDailyAddonUsageTable = await papiClient.post('/addons/data/schemes', bodyDailyAddonUsageTable, headersADAL);
    return retVal;
}

async function CreateAddonCodeJob(client, papiClient, jobName, jobDescription, addonPath, functionName, cronExpression){
    const codeJob = await papiClient.codeJobs.upsert({
        CodeJobName: jobName,
        Description: jobDescription,
        Type: "AddonJob",
        IsScheduled: true,
        CronExpression: cronExpression,
        AddonPath: addonPath,
        FunctionName: functionName,
        AddonUUID: client.AddonUUID,
        NumberOfTries: 1
    });
    console.log("result object recieved from Code jobs is: " + JSON.stringify(codeJob));
    return codeJob;
}

async function GetDistributor(papiClient){
    let distributorData = await papiClient.get('/distributor');
    const machineData = await papiClient.get('/distributor/machine');
    const distributor ={
        InternalID: distributorData.InternalID,
        Name: distributorData.Name,
        MachineAndPort: machineData.Machine + ":" + machineData.Port
    };
    return distributor;
}

//#endregion
