import { InternalSyncTest } from "./api";
import { DEFAULT_MONITOR_LEVEL } from "./installation";
import { VALID_MONITOR_LEVEL_VALUES } from "./relations.var.service";

const syncUUID = '00000000-0000-0000-0000-000000abcdef';

export class SyncTest {
    async syncMonitoring(client, monitorSettingsService, monitorSettings, systemHealthBody){
        let syncParams = {
            errorCode: "",
            succeeded : false
        }
        let errorAuditLogResult = await this.getAuditLogResult(monitorSettingsService, monitorSettings);
        
        //If there were no sync errors in audit log - look for one success
        if(errorAuditLogResult.length == 0){
            await this.noErrorsCase(client, monitorSettings, monitorSettingsService, syncParams, systemHealthBody);
        } else{
            //Else – If there were sync errors
            syncParams['errorCode'] = await InternalSyncTest(systemHealthBody, client, monitorSettingsService, monitorSettings);
            this.updateErrorParams(systemHealthBody, syncParams);
        }
        return syncParams;
    }
    
    async noErrorsCase(client, monitorSettings, monitorSettingsService, syncParams, systemHealthBody){
        let successAuditLogResult = await this.checkForAuditSuccess(monitorSettingsService);
        //If there is at least one success sync
        if(successAuditLogResult.length != 0){
            syncParams['succeeded'] = true;
            this.updateSystemHealthBody(systemHealthBody, 'Success', "Sync succeeded");
        } else{
            this.auditLogIsEmpty(client, monitorSettingsService, systemHealthBody, monitorSettings, syncParams);
        }
    }
    
    async auditLogIsEmpty(client, monitorSettingsService, systemHealthBody, monitorSettings, syncParams){
        if(monitorSettings['MonitorLevel'] === 5){
            syncParams['errorCode'] = await InternalSyncTest(systemHealthBody, client, monitorSettingsService, monitorSettings);
            this.updateSystemHealthBody(systemHealthBody, 'Success', "Sync succeeded");
        }
    }
    
    async checkForAuditSuccess(monitorSettingsService){
        let currentDate = new Date();
        let dateUpdate = (new Date(currentDate.getTime() - DEFAULT_MONITOR_LEVEL*60000)).toISOString(); //taking "monitor level" minutes back 
        let success = "Status.ID=1"
        //filter success sync objects from audit log
        let auditLogResult = await this.getAuditLog(monitorSettingsService ,success, dateUpdate)
        return auditLogResult;
    }
    
    async getAuditLogResult(monitorSettingsService, monitorSettings){
        let lastUpdateAudit = monitorSettings['SyncFailed']['LastUpdate'];
        let currentDate = new Date();
        let minutesToMinus = 30; //if there is no last update time- take 30 minutes back
        let lastUpdate = lastUpdateAudit ?  lastUpdateAudit : (new Date(currentDate.getTime() - minutesToMinus*60000)).toISOString(); //for first insertion to the table- check 30 minutes back
        let currentUpdate = (new Date()).toISOString();
    
        //filter audit log data to return only sync objects from the last update time, 
        //for objects which have 3 retries or ‘Status=failure’ - run an internal sync
        let error = `(Status.ID=0 or (AuditInfo.JobMessageData.NumberOfTry>=3 and Status.ID=4))`
        let auditLogResult = await this.getAuditLog(monitorSettingsService , error, lastUpdate)
        monitorSettings['SyncFailed']['LastUpdate'] = currentUpdate;
    
        //update LastUpdate time in monitorSettings table
        const settingsResponse = await monitorSettingsService.setMonitorSettings(monitorSettings);
        return auditLogResult;
    }
    
    async getAuditLog(monitorSettingsService , status, lastUpdate){
        let auditLogUrl = `/audit_logs?where=AuditInfo.JobMessageData.AddonData.AddonUUID='${syncUUID}' and ${status} and CreationDateTime>='${lastUpdate}'&fields=Status,AuditInfo`;
        let auditLogResult = await monitorSettingsService.papiClient.get(`${auditLogUrl}`);
        return auditLogResult;
    }
    
    updateErrorParams(systemHealthBody, syncParams){
        let internalSyncResponse = syncParams['errorCode'];
        //If internal sync succeeded
        if (internalSyncResponse == 'SUCCESS') {
            syncParams['succeeded'] = true;
            this.updateSystemHealthBody(systemHealthBody, 'Warning', "Sync succeeded but previously failed for some users");
        } else{
            this.updateSystemHealthBody(systemHealthBody, 'Error', "Sync failed");
        }
    }
    
    updateSystemHealthBody(systemHealthBody, status: string, message: string){
        systemHealthBody['Status'] = status;
        systemHealthBody['Message'] = message;
    }


}

