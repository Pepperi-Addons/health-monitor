import { SYNCS_PAGE_SIZE, SYNC_FUNCTION_NAME, SYNC_UUID } from "../entities";
import { BaseElasticSyncService } from "./base-elastic-sync.service";
import jwtDecode from "jwt-decode";
import { parse, toKibanaQueryJSON, concat } from '@pepperi-addons/pepperi-filters';


export class SyncJobsService extends BaseElasticSyncService {
    
    async getSyncsResult() {
        const maintenanceWindow = await this.getMaintenanceWindowHours();
        const distributorUUID = jwtDecode(this.monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributoruuid'];
        const res = await this.getElasticData(this.getSyncBody(maintenanceWindow, distributorUUID));
        return { data: this.fixElasticResultObject(res), 
            searchAfter: res.resultObject.hits.hits?.[res.resultObject.hits.hits.length - 1]?.sort?.[0], // update search_after according to the last doucumnet in the list
            size: res.resultObject.hits.total.value }; // update total number of documents
    }

    fixElasticResultObject(res) {
        return res.resultObject.hits.hits?.map((item) => { return item._source });
    }

    private getSyncBody(maintenanceWindow: number[], distributorUUID: string) {
        const typesMapping = {};
        const whereClauses = [
            `AuditInfo.JobMessageData.AddonData.AddonUUID.keyword='${SYNC_UUID}'`,
            `DistributorUUID.keyword='${distributorUUID}'`,
            `AuditInfo.JobMessageData.FunctionName.keyword='${SYNC_FUNCTION_NAME}'`];
        const filters = whereClauses.join(' AND ');
        
        const typesArray = ["AuditInfo.JobMessageData.AddonData.AddonUUID.keyword", "DistributorUUID.keyword", "AuditInfo.JobMessageData.FunctionName.keyword"];

        Object.keys(typesArray).forEach((key) => {
            typesMapping[key] = 'String';
        });

        const result = parse(filters, typesMapping);
        const conct = this.params.Where ? concat(true, result!, this.params.Where) : result;
        const kibanaQuery = toKibanaQueryJSON(conct);

        kibanaQuery['bool']['must'].push(this.getMaintenanceWindowHoursScript(maintenanceWindow)); // add maintanance window script to the query (to exclude syncs that were created in the maintenance window)
            
        return this.buildQueryParameters(kibanaQuery, SYNCS_PAGE_SIZE);
    }
}
