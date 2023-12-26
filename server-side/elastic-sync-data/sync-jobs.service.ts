import { SYNCS_PAGE_SIZE, SYNC_UUID } from "../entities";
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
            let jobStatus = item._source.Name;
            if(item._source.ID === 1) { // Success
                if(item._source.AuditInfo.ResultObject) {
                    const status = JSON.parse(item._source.AuditInfo.ResultObject);
                    jobStatus = status.errorMessage ? 'Failed' : 'Success';
                }
            }
            
            return {
                UUID: item._source.UUID,
                Status: item._source.CreationDateTime,
                StartDateTime: item._source.AuditInfo.JobMessageData.StartDateTime,
                NumberOfTry: item._source.AuditInfo.JobMessageData.NumberOfTry,
                UserMail: item._source.Event.User.Email,
                ResultStatus: jobStatus
            };
        });
    }

    async getMaintenanceWindowHours() {
        try {
            const maintenanceWindow = (await this.monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get()).MaintenanceWindow;
            return (maintenanceWindow.split(':')).map((item) => {return parseInt(item)});
        } catch(err) {
            console.log(`error getting maintenance window: ${err}`);
        }
    }

    createQueryTerm(field: string, value: string) {
        return {
            term: {
                [field]: value
            }
        }
    }


    getSyncBody(maintenanceWindow: number[], distributorUUID: string, search_after?: number[]) {
        const query =  {
                bool: {
                    must: [
                        this.createQueryTerm("AuditInfo.JobMessageData.CodeJobUUID.keyword", SYNC_UUID),
                        this.createQueryTerm("DistributorUUID", distributorUUID),
                        {
                            script: {
                                script: {
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
