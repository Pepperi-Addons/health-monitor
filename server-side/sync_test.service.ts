import { Client } from "@pepperi-addons/debug-server/dist";
import { StatusUpdate } from "./api";

import { DEFAULT_MONITOR_LEVEL } from "./installation";
import { VALID_MONITOR_LEVEL_VALUES } from "./relations.var.service";
import monitorSettingsService from "./monitor-settings.service";
import { SystemHealthBody, errors, syncPageSize, SYNC_UUID } from "./entities";

const sleep = (milliseconds: number) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

export class SyncTest {
    errorCode: string = 'SUCCESS';
    succeeded: boolean = true;

    constructor(private client: Client, private monitorSettingsService: monitorSettingsService, private monitorSettings, private systemHealthBody: SystemHealthBody) {
        this.client = client;
        this.monitorSettingsService = monitorSettingsService;
        this.monitorSettings = monitorSettings;
        this.systemHealthBody = systemHealthBody
    }

   /**
    * check sync last updated status- if error, perform proactive sync (internal sync test)
    * else check results at audit log and report accordingly.
    */
    async syncMonitor(){
        if (this.monitorSettings['SyncFailed'].Status === false) { // sync failed in the last test
            console.log(`Last sync test status was Error, performing sync test`);
            await this.callProactiveSync();
        } else {
            console.log(`Last system health status was success, checking audit log result`);
            await this.lastStatusSuccessFlow();
        }

        this.succeeded = this.errorCode === 'SUCCESS' ? true : false;
        return { succeeded: this.succeeded };
    }

    // call proactive sync and update system health parameters accordingly
    private async callProactiveSync() {
        console.log(`About to perform a proactive sync`);
        this.errorCode = await this.InternalSyncTest(this.client, this.monitorSettingsService, this.monitorSettings);
        const status = this.errorCode === 'SUCCESS' ? 'Success' : 'Error';
        console.log(`internal sync test result- ${this.errorCode}, about to update system health status`);

        // update sync monitoring object according to internal sync response
        this.updateSystemHealthBody(status, this.errorCode);
    }

    // if last sync test status was success- check for sync failures and continue according monitor level.
    // If there were not sync failures, check if any sync was made; else, update status with success.
    private async lastStatusSuccessFlow() {
        // check for sync failures at the given interval
        const syncFailuresResult = await this.checkSyncFailures();
        if (syncFailuresResult.length === 0) { // no errors
            if (this.monitorSettings['MonitorLevel'] === VALID_MONITOR_LEVEL_VALUES['High']) { // monitor level is high
                // check for any sync
                console.log(`There were no sync failures and monitor level is high, checking for any sync`);
                await this.checkForSync();
            } else {
                console.log(`There were no sync failure and monitor level is not high update system health with success`);
                this.updateSystemHealthBody('Success', "Sync succeeded");
            }

        } else { // there were sync failures at the given interval - perform proactive sync and report accordingly
            console.log(`There were sync failures, performing proactive sync`);
            await this.callProactiveSync();
        }
    }

    // check in audit log any sync was made in the given interval
    private async checkForSync() {
        const dateUpdate = (new Date((new Date()).getTime() - VALID_MONITOR_LEVEL_VALUES[DEFAULT_MONITOR_LEVEL] * 60000)).toISOString(); //taking "monitor level" minutes back 
        const auditLogUrl = `where=AuditInfo.JobMessageData.AddonData.AddonUUID='${SYNC_UUID}' and CreationDateTime>='${dateUpdate}'&fields=UUID,Status,AuditInfo&page_size=${syncPageSize}`;

        console.log(`searching for any sync in the given interval`);
        let auditLogResult = await this.getAuditLog(auditLogUrl);

        if (auditLogResult.length === 0) { // no syncs at the given interval
            console.log(`There were no syncs in the given interval`);
            // proactive sync
            await this.callProactiveSync();
        } else { // there were syncs performed, report success
            console.log(`There were syncs in the given interval, sync status is success`);
            this.updateSystemHealthBody('Success', "Sync succeeded");
        }
    }

    // look for sync failures or sync NumberOfTry greater than 2 retries.
    private async checkSyncFailures() {
        const lastUpdateAudit = this.monitorSettings['SyncFailed']['LastUpdate'];
        const minutesToMinus = 30; //if there is no last update time- take 30 minutes back
        const lastUpdate = lastUpdateAudit ? lastUpdateAudit : (new Date((new Date()).getTime() - minutesToMinus * 60000)).toISOString(); //for first insertion to the table- check 30 minutes back
        const currentUpdate = (new Date()).toISOString();
        const error = `(Status.ID=0 or (AuditInfo.JobMessageData.NumberOfTry>2))`;
        // takes only the first audit log result (no need to get all results)
        const auditLogUrl = `where=AuditInfo.JobMessageData.AddonData.AddonUUID='${SYNC_UUID}' and ${error} and CreationDateTime>='${lastUpdate}'&fields=UUID,Status,AuditInfo&page_size=${syncPageSize}`;

        console.log(`About to search for sync errors`);
        const auditLogResult = await this.getAuditLog(auditLogUrl);

        this.monitorSettings['SyncFailed']['LastUpdate'] = currentUpdate;
        // update LastUpdate time in monitorSettings table
        console.log(`About to update monitor settings with the current timestamp`);
        const settingsResponse = await this.monitorSettingsService.setMonitorSettings(this.monitorSettings);
        console.log(`Updated monitor settings with the current timestamp`);

        return auditLogResult;
    }

    // get audit log results
    private async getAuditLog(auditLogUrl: string) {
        try {
            console.log(`about to get audit log for sync test at URL: ${auditLogUrl}`);
            const auditLogResult = await this.monitorSettingsService.papiClient.get(`/audit_logs?${auditLogUrl}`);
            console.log('successfully got audit log');
            return auditLogResult;
        } catch (err) {
            console.error(`Could not get audit log for ${auditLogUrl}, error: ${err}`);
        }
    }

    private updateSystemHealthBody(status: string, message: string) {
        this.systemHealthBody['Status'] = status;
        this.systemHealthBody['Message'] = message;
    }

    // proactive sync
    private async InternalSyncTest(client, monitorSettingsService, monitorSettings) {
        let udtResponse;
        let syncResponse;
        let statusResponse;
        let object;
        let timeout;
        let start;
        let end;
    
        const addonData = await monitorSettingsService.getMonitorSettings();
        let mapDataID = addonData.SyncFailed.MapDataID;
    
        //first udt
        try {
            console.log('HealthMonitorAddon, SyncFailedTest start first GET udt');
            timeout = setTimeout(async  () => {
                //return 'TIMEOUT-GET-UDT';
                this.updateSystemHealthBody('Error', errors['TIMEOUT-GET-UDT']["Message"]);
                await StatusUpdate(this.systemHealthBody, client, monitorSettingsService, false, false, 'TIMEOUT-GET-UDT', '', monitorSettings);
            }, 30000);
            start = Date.now();
            udtResponse = await monitorSettingsService.papiClient.get('/user_defined_tables/' + mapDataID);
            end = Date.now();
            clearTimeout(timeout);
            console.log('HealthMonitorAddon, SyncFailedTest finish first GET udt took ' + (end - start) + ' milliseconds',);
        }
        catch (error) {
            return 'GET-UDT-FAILED';
        }
        finally {
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
        try {
            let timeoutReached: boolean = false;
            console.log('HealthMonitorAddon, SyncFailedTest start POST sync');
            timeout = setTimeout(async  () => {
                //return 'TIMEOUT-SYNC';
                this.updateSystemHealthBody('Error', errors['TIMEOUT-SYNC']["Message"]);
                await StatusUpdate(this.systemHealthBody, client, monitorSettingsService, false, false, 'TIMEOUT-SYNC', '', monitorSettings);
                timeoutReached = true;
            }, 120000);
            start = Date.now();
            syncResponse = await monitorSettingsService.papiClient.post('/application/sync', body);
    
            const syncJobUUID = syncResponse.SyncJobUUID;
            //check if the values field have been updated
            statusResponse = await monitorSettingsService.papiClient.get('/application/sync/jobinfo/' + syncJobUUID);
            while (!timeoutReached && (statusResponse.Status == 'SyncStart' || statusResponse.Status == 'New' || statusResponse.Status == 'PutInProgress' || statusResponse.Status == 'GetInProgress')) {
                await sleep(2000);
                statusResponse = await monitorSettingsService.papiClient.get('/application/sync/jobinfo/' + syncJobUUID);
            }
            end = Date.now();
            clearTimeout(timeout);
            console.log('HealthMonitorAddon, SyncFailedTest finish POST sync took ' + (end - start) + ' milliseconds');
        }
        catch (error) {
            return 'SYNC-CALL-FAILED';
        }
        finally {
            clearTimeout(timeout);
        }
    
        if (statusResponse.Status == 'Done') {
            //second udt
            try {
                console.log('HealthMonitorAddon, SyncFailedTest start second GET udt');
                timeout = setTimeout(async  () => {
                    //return 'TIMEOUT-GET-UDT';
                    this.updateSystemHealthBody('Error', errors['TIMEOUT-GET-UDT']["Message"]);
                    await StatusUpdate(this.systemHealthBody, client, monitorSettingsService, false, false, 'TIMEOUT-GET-UDT', '', monitorSettings);
                }, 30000);
                start = Date.now();
                udtResponse = await monitorSettingsService.papiClient.get('/user_defined_tables/' + mapDataID);
                end = Date.now();
                clearTimeout(timeout);
                console.log('HealthMonitorAddon, SyncFailedTest finish second GET udt took ' + (end - start) + ' milliseconds');
            }
            catch (error) {
                return 'GET-UDT-FAILED';
            }
            finally {
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
    
}

