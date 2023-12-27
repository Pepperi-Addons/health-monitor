import { SYNCS_PAGE_SIZE, SYNC_FUNCTION_NAME, SYNC_UUID } from "../entities";
import { BaseElasticSyncService } from "./base-elastic-sync.service";
import jwtDecode from "jwt-decode";

export class SyncJobsService extends BaseElasticSyncService {
    
    async getSyncsResult(search_after?: number[]) {
        const maintenanceWindow = await this.getMaintenanceWindowHours();
        const distributorUUID = jwtDecode(this.monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributoruuid'];
        const res = await this.getElasticData(this.getSyncBody(maintenanceWindow, distributorUUID, search_after));
        return this.fixElasticResultObject(res);
    }

    fixElasticResultObject(res) {
        return res.resultObject.hits.hits.map((item) => {            
            return {
                UUID: item._source.UUID,
                Status: item._source.Name === 'InRetry' ? 'InProgress' : item._source.AuditInfo.JobMessageData.Status,
                StartDateTime: item._source.AuditInfo.JobMessageData.StartDateTime,
                NumberOfTry: item._source.AuditInfo.JobMessageData.NumberOfTry,
                UserMail: item._source.Event.User.Email
            };
        });
    }

    private async getMaintenanceWindowHours() {
        try {
            const maintenanceWindow = (await this.monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get()).MaintenanceWindow;
            return (maintenanceWindow.split(':')).map((item) => { return parseInt(item)} );
        } catch(err) {
            console.log(`error getting maintenance window: ${err}`);
        }
    }

    private createQueryTerm(field: string, value: string) {
        return {
            term: {
                [field]: value
            }
        }
    }


    private getSyncBody(maintenanceWindow: number[], distributorUUID: string, search_after?: number[]) {
        const query =  {
                bool: {
                    must: [
                        this.createQueryTerm("AuditInfo.JobMessageData.AddonData.AddonUUID.keyword", SYNC_UUID),
                        this.createQueryTerm("DistributorUUID", distributorUUID),
                        this.createQueryTerm("AuditInfo.JobMessageData.FunctionName.keyword", SYNC_FUNCTION_NAME), // need to filter on function name, or else we will also get the internal syncs
                        {
                            script: {
                                script: { // excluding maintenance window hours
                                    source: `
                                        def targetHour = doc['CreationDateTime'].value.hourOfDay;
                                        def targetMinute = doc['CreationDateTime'].value.minuteOfHour;
                                        
                                        def targetTime = targetHour * 60 + targetMinute;
                                        def startTime = ${maintenanceWindow[0]} * 60 + ${maintenanceWindow[1]};
                                        def endTime = ${maintenanceWindow[0] + 1} * 60 + ${maintenanceWindow[1]};
                                        
                                        return targetTime < startTime || targetTime > endTime;
                                    `
                                }
                            }
                        }
                    ]
                }
            
        }
        return this.buildQueryParameters(query, SYNCS_PAGE_SIZE, search_after);
    }
}
