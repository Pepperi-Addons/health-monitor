
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
import MyService from './my.service';
import { Service } from "aws-sdk";


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

        client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
        const service = new MyService(client);

        // install SyncFailed test
        let retValSyncFailed = await InstallSyncFailed(service);
        successSyncFailed = retValSyncFailed.success;
        errorMessage = "SyncFailed Test installation failed on: " + retValSyncFailed.errorMessage;
        if (!successSyncFailed){
            console.error(errorMessage);
            return retValSyncFailed;
        }
        console.log('SyncFailed codejob installed succeeded.');

        // install JobLimitReached test
        let retValJobLimitReached = await InstallJobLimitReached(service);
        successJobLimitReached = retValJobLimitReached.success;
        errorMessage = "JobLimitReached Test installation failed on: " + retValJobLimitReached.errorMessage;
        if (!successJobLimitReached){
            console.error(errorMessage);
            return retValJobLimitReached;
        }
        console.log('JobLimitReached codejob installed succeeded.');

        // install JobExecutionFailed test
        let retValJobExecutionFailed = await InstallJobExecutionFailed(service);
        successJobExecutionFailed = retValJobExecutionFailed.success;
        errorMessage = "JobExecutionFailed Test installation failed on: " + retValJobExecutionFailed.errorMessage;
        if (!successJobExecutionFailed){
            console.error(errorMessage);
            return retValJobExecutionFailed;
        }
        console.log('JobExecutionFailed codejob installed succeeded.');

        // install DailyAddonUsage codejob
        let retValDailyAddonUsage = await InstallDailyAddonUsage(service);
        successDailyAddonUsage = retValDailyAddonUsage.success;
        errorMessage = "DailyAddonUsage codejob installation failed on: " + retValDailyAddonUsage.errorMessage;
        if (!successDailyAddonUsage){
            console.error(errorMessage);
            return retValDailyAddonUsage;
        }
        console.log('DailyAddonUsage codejob installed succeeded.');
        
        // install PepperiUsageMonitor code job
        let retValUsageMonitor = await InstallUsageMonitor(service);
        successUsageMonitor = retValUsageMonitor.success;
        errorMessage = "UsageMonitor installation failed on: " + retValUsageMonitor.errorMessage;
        if (!successUsageMonitor){
            console.error(errorMessage);
            return retValUsageMonitor;
        }
        console.log('UsageMonitor codejob installed succeeded.');

        // from 2.1 addon settings on ADAL
        const bodyADAL:AddonDataScheme = {
            Name: 'HealthMonitorSettings',
            Type: 'meta_data'
        };
        const headersADAL = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        };

        const responseSettingsTable = await service.papiClient.post('/addons/data/schemes', bodyADAL, headersADAL);

        const data = {};
        const distributor = await GetDistributor(service.papiClient);
        const monitorLevel = await service.papiClient.get('/meta_data/flags/MonitorLevel');
        data["Name"] = distributor.Name;
        data["MachineAndPort"] = distributor.MachineAndPort;
        data["MonitorLevel"] = (monitorLevel ==false) ? 4 : monitorLevel;
        data["SyncFailed"] = { Type:"Sync failed", Status: true, ErrorCounter:0, MapDataID: retValSyncFailed["mapDataID"], Email:"", Webhook:"",Interval:parseInt(retValSyncFailed["interval"])*60*1000 };
        data["JobLimitReached"] = {Type:"Job limit reached", LastPercantage:0, Email:"", Webhook:"",Interval:24*60*60*1000};
        data["JobExecutionFailed"] = {Type:"Job execution failed", Email:"", Webhook:"",Interval:24*60*60*1000};
        data[retValSyncFailed["codeJobName"]] = retValSyncFailed["codeJobUUID"];
        data[retValJobLimitReached["codeJobName"]] = retValJobLimitReached["codeJobUUID"];
        data[retValJobExecutionFailed["codeJobName"]] = retValJobExecutionFailed["codeJobUUID"];
        data[retValDailyAddonUsage["codeJobName"]] = retValDailyAddonUsage["codeJobUUID"];
        data[retValUsageMonitor["codeJobName"]] = retValUsageMonitor["codeJobUUID"];
        const settingsBodyADAL= {
            Key: distributor.InternalID.toString(),
            Data: data
        };
        const settingsResponse = await service.papiClient.addons.data.uuid(client.AddonUUID).table('HealthMonitorSettings').upsert(settingsBodyADAL);

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
        client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
        const service = new MyService(client);
        const monitorSettings = await service.getMonitorSettings();

        // unschedule SyncFailed test
        let syncFailedCodeJobUUID = monitorSettings.SyncFailedCodeJobUUID;
        if(syncFailedCodeJobUUID != '') {
            await service.papiClient.codeJobs.upsert({
                UUID:syncFailedCodeJobUUID,
                CodeJobName: "SyncFailed Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('SyncFailed codejob unschedule succeeded.');

        // unschedule JobLimitReached test
        let jobLimitReachedCodeJobUUID = monitorSettings.JobLimitReachedCodeJobUUID 
        if(jobLimitReachedCodeJobUUID != '') {
            await service.papiClient.codeJobs.upsert({
                UUID:jobLimitReachedCodeJobUUID,
                CodeJobName: "JobLimitReached Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('JobLimitReached codejob unschedule succeeded.');

        // unschedule JobExecutionFailed test
        let jobExecutionFailedCodeJobUUID = monitorSettings.JobExecutionFailedCodeJobUUID;
        if(jobExecutionFailedCodeJobUUID != '') {
            await service.papiClient.codeJobs.upsert({
                UUID:jobExecutionFailedCodeJobUUID,
                CodeJobName: "JobExecutionFailed Test",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('JobExecutionFailed codejob unschedule succeeded.');

        // unschedule DailyAddonUsage
        let dailyAddonUsageCodeJobUUID = monitorSettings.DailyAddonUsageCodeJobUUID;
        if(dailyAddonUsageCodeJobUUID != '') {
            await service.papiClient.codeJobs.upsert({
                UUID:dailyAddonUsageCodeJobUUID,
                CodeJobName: "DailyAddonUsage",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('DailyAddonUsage codejob unschedule succeeded.');

        // unschedule UsageMonitor
        let UsageMonitorCodeJobUUID = monitorSettings.UsageMonitorCodeJobUUID;
        if(UsageMonitorCodeJobUUID != '') {
            await service.papiClient.codeJobs.upsert({
                UUID:UsageMonitorCodeJobUUID,
                CodeJobName: "Pepperi Usage Monitor Addon Code Job",
                IsScheduled: false,
                CodeJobIsHidden:true
            });
        }
        console.log('UsageMonitor codejob unschedule succeeded.');

        // purge ADAL tables
        var headersADAL = {
            "X-Pepperi-OwnerID": client.AddonUUID,
            "X-Pepperi-SecretKey": client.AddonSecretKey
        }
        const responseDailyAddonUsageTable = await service.papiClient.post('/addons/data/schemes/DailyAddonUsage/purge',null, headersADAL);
        const responsePepperiUsageMonitorTable = await service.papiClient.post('/addons/data/schemes/PepperiUsageMonitor/purge',null, headersADAL);
        const responseSettingsTable = await service.papiClient.post('/addons/data/schemes/HealthMonitorSettings/purge',null, headersADAL);

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

    client.AddonUUID = "7e15d4cc-55a7-4128-a9fe-0e877ba90069";
    const service = new MyService(client);

    try {
        let addon = await service.papiClient.addons.installedAddons.addonUUID(client.AddonUUID).get();
        const version = addon?.Version?.split('.').map(item => {return Number(item)}) || [];

        // upgrade to 2.1 from 2.0 or 1.0 versions
        if (version.length==3 && ((version[0] < 2) || (version[0] == 2 && version[1] <1))){
            const additionalData = addon.AdditionalData? addon.AdditionalData : "";
            let data = JSON.parse(additionalData);

            // install UsageMonitor if not installed yet from version 2.0
            if (version.length==3 && version[0] < 2){         
                let retValUsageMonitor = await InstallUsageMonitor(service);
                let successUsageMonitor = retValUsageMonitor.success;
                errorMessage = "DailyAddonUsage codejob installation failed on: " + retValUsageMonitor.errorMessage;
                if (!successUsageMonitor){
                    console.error(errorMessage);
                    return retValUsageMonitor;
                }
                console.log('DailyAddonUsage codejob installed succeeded.');
                data[retValUsageMonitor["codeJobName"]] = retValUsageMonitor["codeJobUUID"];
            }

            // upgrade to version 2.1.0 - move addon settings from additional data to ADAL
            const bodyADAL:AddonDataScheme = {
                Name: 'HealthMonitorSettings',
                Type: 'meta_data'
            };
            const headersADAL = {
                "X-Pepperi-OwnerID": client.AddonUUID,
                "X-Pepperi-SecretKey": client.AddonSecretKey
            };
            const responseSettingsTable = await service.papiClient.post('/addons/data/schemes', bodyADAL, headersADAL);
            const distributor = await GetDistributor(service.papiClient);
            const monitorLevel = await service.papiClient.get('/meta_data/flags/MonitorLevel');
            data["MonitorLevel"] = (monitorLevel ==false) ? 4 : monitorLevel;
            const settingsBodyADAL= {
                Key: distributor.InternalID.toString(),
                Data: data
            };
            const settingsResponse = await service.papiClient.addons.data.uuid(client.AddonUUID).table('HealthMonitorSettings').upsert(settingsBodyADAL);
            console.log('HealthMonitor upgrade from additional data to ADAL succeeded.');
        }
        
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

//#region install code jobs

async function InstallJobLimitReached(service){
    let retVal={
        success: true,
        errorMessage: ''
    };

    try{
        let codeJob = await CreateAddonCodeJob(service, "JobLimitReached Test", "JobLimitReached Test for HealthMonitor Addon. Check distributor not pass the addons execution limit.", "api", 
        "job_limit_reached", GetJobLimitCronExpression(service.client.OAuthAccessToken));
        retVal["codeJobName"] = 'JobLimitReachedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
    }
    catch (err){
        retVal = {
            success: false,
            errorMessage: err.message
        };
    }
    return retVal;
}

async function InstallAddonLimitReached(service){
    let retVal={
        success: true,
        errorMessage: ''
    };

    try{
        let codeJob = await CreateAddonCodeJob(service, "AddonLimitReached Test", "AddonLimitReached Test for HealthMonitor Addon. Check distributor not pass the addons execution limit.", "api", 
        "addon_limit_reached", GetAddonLimitCronExpression(service.client.OAuthAccessToken));
        retVal["codeJobName"] = 'AddonLimitReachedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
    }
    catch (err){
        retVal = {
            success: false,
            errorMessage: err.message
        };
    }
    return retVal;
}

async function InstallJobExecutionFailed(service){
    let retVal={
        success: true,
        errorMessage: ''
    };

    try{
        let codeJob = await CreateAddonCodeJob(service, "JobExecutionFailed Test", "JobExecutionFailed Test for HealthMonitor Addon.", "api", 
        "job_execution_failed", GetJobExecutionCronExpression(service.client.OAuthAccessToken));
        retVal["codeJobName"] = 'JobExecutionFailedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
    }
    catch (err){
        retVal = {
            success: false,
            errorMessage: err.message
        };
    }
    return retVal;
}

async function InstallDailyAddonUsage(service){
    let retVal={
        success: true,
        errorMessage: ''
    };

    try{
        let codeJob = await CreateAddonCodeJob(service, "DailyAddonUsage", "DailyAddonUsage for HealthMonitor Addon.", "addon-usage", 
        "daily_addon_usage", GetDailyAddonUsageCronExpression(service.client.OAuthAccessToken));
        retVal["codeJobName"] = 'DailyAddonUsageCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;

        // add table to ADAL
        const bodyDailyAddonUsageTable:AddonDataScheme = {
            Name: 'DailyAddonUsage',
            Type: 'meta_data'
        };
        const headersADAL = {
            "X-Pepperi-OwnerID": service.client.AddonUUID,
            "X-Pepperi-SecretKey": service.client.AddonSecretKey
        }
        const responseDailyAddonUsageTable = await service.papiClient.post('/addons/data/schemes', bodyDailyAddonUsageTable, headersADAL);
    }
    catch(err){
        retVal = {
            success: false,
            errorMessage: err.message
        };
    }
    return retVal;
}

async function InstallUsageMonitor(service){
    let retVal={
        success: true,
        errorMessage: ''
    };

    try {
        // Install scheme for Pepperi Usage Monitor
        try {
            await service.papiClient.addons.data.schemes.post(PepperiUsageMonitorTable);
            console.log('PepperiUsageMonitor Table installed successfully.');
        }
        catch (err) {
            retVal = {
                success: false,
                errorMessage: ('message' in err) ? err.message : 'Could not install HealthMonitorAddon. Create PepperiUsageMonitor table failed.',
            }
        }

        // Install code job for Pepperi Usage Monitor
        try {
            const codeJob = await service.papiClient.codeJobs.upsert({
                CodeJobName: "Pepperi Usage Monitor Addon Code Job",
                Description: "Pepperi Usage Monitor",
                Type: "AddonJob",
                IsScheduled: true,
                CronExpression: getCronExpression(),
                AddonPath: "api-success-monitor",
                FunctionName: "run_collect_data",
                AddonUUID: service.client.AddonUUID,
                NumberOfTries: 30,
            });
            retVal["codeJobName"] = 'UsageMonitorCodeJobUUID';
            retVal["codeJobUUID"] = codeJob.UUID;
            console.log('PepperiUsageMonitor code job installed successfully.');
        }
        catch (err)
        {
            retVal = {
                success: false,
                errorMessage: ('message' in err) ? err.message : 'Could not install HealthMonitorAddon. Create PepperiUsageMonitor code job failed.',
            }
        }
    }
    catch (err) {
        retVal = {
            success: false,
            errorMessage: ('message' in err) ? err.message : 'Cannot install HealthMonitorAddon (PepperiUsageMonitor). Unknown Error Occured',
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

function GetMonitorCronExpression(token, maintenanceWindowHour, interval){
    // rand is integet between 0-4 included.
    const rand = (jwtDecode(token)['pepperi.distributorid'])%interval;
    const minute = rand +"-59/"+interval;
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

async function InstallSyncFailed(service){
    let retVal={
        success: true,
        errorMessage: ''
    };

    try{
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
    
        const resultAddUDT = await service.papiClient.metaData.userDefinedTables.upsert(mapDataMetaData);
        const resultAddUDTRow = await service.papiClient.userDefinedTables.upsert(mapData);
    
        const maintenance = await service.papiClient.metaData.flags.name('Maintenance').get();
        const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);
        let monitorLevel = await service.papiClient.get('/meta_data/flags/MonitorLevel');
        monitorLevel = (monitorLevel==false) ? 4 :monitorLevel;
        const interval = monitorLevel>1? 15 : 5;
        let codeJob = await CreateAddonCodeJob(service, "SyncFailed Test", "SyncFailed Test for HealthMonitor Addon.", "api", "sync_failed", GetMonitorCronExpression(service.client.OAuthAccessToken, maintenanceWindowHour, interval));
        retVal["mapDataID"]=resultAddUDTRow.InternalID;
        retVal["codeJobName"] = 'SyncFailedCodeJobUUID';
        retVal["codeJobUUID"] = codeJob.UUID;
        retVal["interval"] = monitorLevel>1? 15 : 5;
    }
    catch (err){
        retVal = {
            success: false,
            errorMessage: err.message
        };
    }
    return retVal;
}

async function CreateAddonCodeJob(service, jobName, jobDescription, addonPath, functionName, cronExpression){
    const codeJob = await service.papiClient.codeJobs.upsert({
        CodeJobName: jobName,
        Description: jobDescription,
        Type: "AddonJob",
        IsScheduled: true,
        CronExpression: cronExpression,
        AddonPath: addonPath,
        FunctionName: functionName,
        AddonUUID: service.client.AddonUUID,
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

//#endregion