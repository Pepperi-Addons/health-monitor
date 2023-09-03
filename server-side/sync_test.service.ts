import { Client } from "@pepperi-addons/debug-server/dist";
import { InternalSyncTest } from "./api";
import { DEFAULT_MONITOR_LEVEL } from "./installation";
import { VALID_MONITOR_LEVEL_VALUES } from "./relations.var.service";
import monitorSettingsService from "./monitor-settings.service";
 
export class SyncTest {
    client: Client;
    monitorSettingsService: monitorSettingsService;
    monitorSettings;
    systemHealthBody: SystemHealthBody;
    errorCode: string = 'SUCCESS';
    succeeded: boolean = true;

    constructor(client: Client, monitorSettingsService: monitorSettingsService, monitorSettings, systemHealthBody: SystemHealthBody){
        this.client = client;
        this.monitorSettingsService = monitorSettingsService;
        this.monitorSettings = monitorSettings;
        this.systemHealthBody = systemHealthBody
    }

    // check sync last updated status- if error, perform proactive sync (internal sync test)
    // else check results at audit log and report accordingly.
    async syncMonitor(){
        if(this.monitorSettings['SyncFailed'].Status === false){ // sync failed in the last test
            console.log(`Last sync test status was Error, performing sync test`);
            // proactive sync
            await this.callProactiveSync();
        } else{ // sync succeeded
            console.log(`Last system health status was success, checking audit log result`);
            await this.lastStatusSuccessFlow();
        }

        this.succeeded = this.errorCode === 'SUCCESS' ? true : false;
        return { succeeded: this.succeeded };
    }

    // call proactive sync and update system health parameters accordingly
    async callProactiveSync(){
        console.log(`About to perform a proactive sync`);
        this.errorCode = await InternalSyncTest(this.systemHealthBody, this.client, this.monitorSettingsService, this.monitorSettings);
        const status = this.errorCode === 'SUCCESS' ? 'Success' : 'Error';
        console.log(`internal sync test result- ${status}, about to update system health status`);

        // update sync monitoring object according to internal sync response
        this.updateSystemHealthBody(status, this.errorCode);
    }

    // if last sync test status was success- check for sync failures and continue according monitor level.
    // If there were not sync failures, check if any sync was made; else, update status with success.
    async lastStatusSuccessFlow(){
        // check for sync failures at the given interval
        const syncFailuresResult = await this.checkSyncFailures();
        if(syncFailuresResult.length === 0){ // no errors
            if(this.monitorSettings['MonitorLevel'] === VALID_MONITOR_LEVEL_VALUES['High']){ // monitor level is high
                // check for any sync
                console.log(`There were no sync failures and monitor level is high, checking for any sync`);
                await this.checkForSync();
            } else {
                console.log(`There were no sync failure and monitor level is not high update system health with success`);
                this.updateSystemHealthBody('Success', "Sync succeeded");
            }

        } else{ // there were sync failures at the given interval - perform proactive sync and report accordingly
            console.log(`There were sync failures, performing proactive sync`);
            await this.callProactiveSync();
        }
    }

    // check in audit log any sync was made in the given interval
    async checkForSync(){
        let dateUpdate = (new Date((new Date()).getTime() - VALID_MONITOR_LEVEL_VALUES[DEFAULT_MONITOR_LEVEL] * 60000)).toISOString(); //taking "monitor level" minutes back 
        let auditLogUrl = `where=AuditInfo.JobMessageData.AddonData.AddonUUID='${syncUUID}' and CreationDateTime>='${dateUpdate}'&fields=UUID,Status,AuditInfo&page_size=${syncPageSize}`;

        console.log(`searching for any sync in the given interval`);
        let auditLogResult = await this.getAuditLog(auditLogUrl);

        if(auditLogResult.length === 0){ // no syncs at the given interval
            console.log(`There were no syncs in the given interval`);
            // proactive sync
            await this.callProactiveSync();
        } else{ // there were syncs performed, report success
            console.log(`There were syncs in the given interval, sync status is success`);
            this.updateSystemHealthBody('Success', "Sync succeeded");
        }
    }

    // look for sync failures or sync NumberOfTry greater than 2 retries.
    async checkSyncFailures(){
        let lastUpdateAudit = this.monitorSettings['SyncFailed']['LastUpdate'];
        let minutesToMinus = 30; //if there is no last update time- take 30 minutes back
        let lastUpdate = lastUpdateAudit ? lastUpdateAudit : (new Date((new Date()).getTime() - minutesToMinus * 60000)).toISOString(); //for first insertion to the table- check 30 minutes back
        let currentUpdate = (new Date()).toISOString();
        let error = `(Status.ID=0 or (AuditInfo.JobMessageData.NumberOfTry>2))`;
        // takes only the first audit log result (no need to get all results)
        let auditLogUrl = `where=AuditInfo.JobMessageData.AddonData.AddonUUID='${syncUUID}' and ${error} and CreationDateTime>='${lastUpdate}'&fields=UUID,Status,AuditInfo&page_size=${syncPageSize}`;
        
        console.log(`About to search for sync errors`);
        let auditLogResult = await this.getAuditLog(auditLogUrl);

        this.monitorSettings['SyncFailed']['LastUpdate'] = currentUpdate;
        // update LastUpdate time in monitorSettings table
        console.log(`About to update monitor settings with the current timestamp`);
        const settingsResponse = await this.monitorSettingsService.setMonitorSettings(this.monitorSettings);
        console.log(`Updated monitor settings with the current timestamp`);

        return auditLogResult;
    }
    
    // get audit log results
    async getAuditLog(auditLogUrl: string){
        try{
            console.log(`about to get audit log for sync test at URL: ${auditLogUrl}`);
            let auditLogResult = await this.monitorSettingsService.papiClient.get(`/audit_logs?${auditLogUrl}`);
            console.log('successfully got audit log');
            return auditLogResult;
        } catch(err){
            console.error(`Could not get audit log for ${auditLogUrl}, error: ${err}`);
        }  
    }
    
    updateSystemHealthBody(status: string, message: string){
        this.systemHealthBody['Status'] = status;
        this.systemHealthBody['Message'] = message;
    }
}

