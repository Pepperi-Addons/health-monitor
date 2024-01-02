import { SYNCS_PAGE_SIZE, SYNC_FUNCTION_NAME, SYNC_UUID } from "../entities";
import { BaseElasticSyncService } from "./base-elastic-sync.service";
import jwtDecode from "jwt-decode";

export class SyncJobsService extends BaseElasticSyncService {
    
    async getSyncsResult() {
        const maintenanceWindow = await this.getMaintenanceWindowHours();
        const distributorUUID = jwtDecode(this.monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributoruuid'];
        const res = await this.getElasticData(this.getSyncBody(maintenanceWindow, distributorUUID));
        return this.fixElasticResultObject(res);
    }

    fixElasticResultObject(res) {
        return res.resultObject.hits.hits.map((item) => {            
            return {
                UUID: item._source.UUID,
                Status: item._source.Name === ('InRetry' || 'InProgress') ? 'In Progress' : item._source.AuditInfo.JobMessageData.Status,
                StartDateTime: item._source.AuditInfo.JobMessageData.StartDateTime,
                NumberOfTry: item._source.AuditInfo.JobMessageData.NumberOfTry,
                UserMail: item._source.Event.User.Email
            };
        });
    }

    private getSyncBody(maintenanceWindow: number[], distributorUUID: string) {
        const query =  {
                bool: {
                    must: [
                        this.createQueryTerm("AuditInfo.JobMessageData.AddonData.AddonUUID.keyword", SYNC_UUID),
                        this.createQueryTerm("DistributorUUID", distributorUUID),
                        this.createQueryTerm("AuditInfo.JobMessageData.FunctionName.keyword", SYNC_FUNCTION_NAME), // need to filter on function name, or else we will also get the internal syncs
                        this.getMaintenanceWindowHoursScript(maintenanceWindow)
                    ]
                }
            
        }
        return this.buildQueryParameters(query, SYNCS_PAGE_SIZE);
    }
}
