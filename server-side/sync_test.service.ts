import { InternalSyncTest } from "./api";
import { DEFAULT_MONITOR_LEVEL } from "./installation";
import { VALID_MONITOR_LEVEL_VALUES } from "./relations.var.service";

const syncUUID = '00000000-0000-0000-0000-000000abcdef';
const pageSize = 1;
 
export class SyncTest {

    async syncMonitoring(client, monitorSettingsService, monitorSettings, systemHealthBody){
        let syncParams = { // default parameters
            errorCode: 'SUCCESS',
            succeeded : true
        }
        // look for sync failures or sync number of tries greater than 3 - since the last test was done
        let errorAuditLogResult = await this.getAuditLogResult(monitorSettingsService, monitorSettings);
        
        if(errorAuditLogResult.length == 0){
            //If there were no sync errors in audit log - look for one success
            await this.noErrorsCase(client, monitorSettings, monitorSettingsService, syncParams, systemHealthBody);
        } else{
            //Else – If there were sync errors - perform an internal sync test
            syncParams.errorCode = await InternalSyncTest(systemHealthBody, client, monitorSettingsService, monitorSettings);
            this.updateErrorParams(systemHealthBody, syncParams, errorAuditLogResult[0]);
        }
        syncParams.succeeded = syncParams.errorCode === 'SUCCESS' ? true : false;
        return syncParams;
    }
    
    // check if there were success sync operation since the last check was done
    async noErrorsCase(client, monitorSettings, monitorSettingsService, syncParams, systemHealthBody){
        let successAuditLogResult = await this.checkForAuditSuccess(monitorSettingsService);
        if(successAuditLogResult.length != 0){
            //If there is at least one success sync
            console.log(`no sync failures were found, monitored body status is success`);
            this.updateSystemHealthBody(systemHealthBody, 'Success', "Sync succeeded");
        } else{
            await this.auditLogIsEmpty(client, monitorSettingsService, systemHealthBody, monitorSettings, syncParams);
        }
    }
    
    // if there was no success sync operation since the last test and MonitorLevel is high - perform internal sync test. else- do nothing
    async auditLogIsEmpty(client, monitorSettingsService, systemHealthBody, monitorSettings, syncParams){
        console.log(`monitor level: ${monitorSettings['MonitorLevel']}`);

        if(monitorSettings['MonitorLevel'] === 5){
            console.log('audit log is empty and monitor level is high- performing internal sync test');
            syncParams.errorCode = await InternalSyncTest(systemHealthBody, client, monitorSettingsService, monitorSettings);
            console.log('audit log is empty and monitor level is high- finished sync test');

            const status = syncParams.errorCode === 'SUCCESS' ? 'Success' : 'Error';
            console.log(`internal sync test- ${status}`);

            // update sync monitoring object according to internal sync response
            this.updateSystemHealthBody(systemHealthBody, status, syncParams.errorCode);
        } else{
            console.log('audit log is empty and monitor level is not high- no internal sync test was made');
        }
    }
    
    //filter success sync objects from audit log
    async checkForAuditSuccess(monitorSettingsService){
        let currentDate = new Date();
        let dateUpdate = (new Date(currentDate.getTime() - VALID_MONITOR_LEVEL_VALUES[DEFAULT_MONITOR_LEVEL] * 60000)).toISOString(); //taking "monitor level" minutes back 
        let success = "Status.ID=1"
        console.log(`searching for sync success`);
        let auditLogResult = await this.getAuditLog(monitorSettingsService ,success, dateUpdate)
        return auditLogResult;
    }
    
    //look for sync failures or sync NumberOfTry greater than 2 retries.
    //for objects which have 3 retries or ‘Status=failure’ - run an internal sync
    async getAuditLogResult(monitorSettingsService, monitorSettings){
        let lastUpdateAudit = monitorSettings['SyncFailed']['LastUpdate'];
        let currentDate = new Date();
        let minutesToMinus = 30; //if there is no last update time- take 30 minutes back
        let lastUpdate = lastUpdateAudit ? lastUpdateAudit : (new Date(currentDate.getTime() - minutesToMinus * 60000)).toISOString(); //for first insertion to the table- check 30 minutes back
        let currentUpdate = (new Date()).toISOString();
    
        let error = `(Status.ID=0 or (AuditInfo.JobMessageData.NumberOfTry>=2 and Status.ID=4))`
        let auditLogResult = await this.getAuditLog(monitorSettingsService , error, lastUpdate)
        monitorSettings['SyncFailed']['LastUpdate'] = currentUpdate;
    
        //update LastUpdate time in monitorSettings table
        const settingsResponse = await monitorSettingsService.setMonitorSettings(monitorSettings);
        return auditLogResult;
    }
    
    // get audit log results
    async getAuditLog(monitorSettingsService , status, lastUpdate){
        // takes only the first audit log result (no need to get all results)
        let auditLogUrl = `/audit_logs?where=AuditInfo.JobMessageData.AddonData.AddonUUID='${syncUUID}' and ${status} and CreationDateTime>='${lastUpdate}'&fields=UUID,Status,AuditInfo&page_size=${pageSize}`;
        
        console.log('about to get audit log for sync failure');
        let auditLogResult = await monitorSettingsService.papiClient.get(`${auditLogUrl}`);
        console.log('successfully got audit log');

        return auditLogResult;
    }
    
    updateErrorParams(systemHealthBody, syncParams, auditLogErrorObject){
        let internalSyncResponse = syncParams.errorCode;
        //If internal sync succeeded
        if (internalSyncResponse == 'SUCCESS') {
            console.log(`there was sync error, but a successful internal sync`);
            this.updateSystemHealthBody(systemHealthBody, 'Warning', `Sync succeeded but previously failed for some users. ExecutionUUID for example : ${auditLogErrorObject.UUID}`);
        } else{
            console.log(`there was sync error, and internal sync error`);
            this.updateSystemHealthBody(systemHealthBody, 'Error', `Sync failed. ExecutionUUID for example : ${auditLogErrorObject.UUID}`);
        }
    }
    
    updateSystemHealthBody(systemHealthBody, status: string, message: string){
        systemHealthBody['Status'] = status;
        systemHealthBody['Message'] = message;
    }
}

