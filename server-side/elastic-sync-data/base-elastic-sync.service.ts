import { Client } from '@pepperi-addons/debug-server/dist';
import { callElasticSearchLambda } from '@pepperi-addons/system-addon-utils';
import MonitorSettingsService from '../monitor-settings.service';
import { parse, toKibanaQueryJSON } from '@pepperi-addons/pepperi-filters';
import { AUDIT_LOG_INDEX } from '../entities';

export abstract class BaseElasticSyncService {
    protected monitorSettingsService = new MonitorSettingsService(this.client);
    protected search_after: number[] = [];

    constructor(private client: Client, search_after: number[] = []) {
        this.search_after = search_after;
    }

    protected abstract getSyncsResult(res);

    protected abstract fixElasticResultObject(res);

    protected async getElasticData(requestBody) {
        const elasticEndpoint = `${AUDIT_LOG_INDEX}/_search`;

        try{
            console.log(`About to search data in elastic`);
            const res = await callElasticSearchLambda(elasticEndpoint, 'POST', requestBody );
            console.log("Successfully got data from elastic.");
            return res;
        } catch(err){
            throw new Error(`Could not search data in elastic, error: ${err}`);
        }
    }

    protected getElasticBody(query: string, fieldsMap, size: number) {
        const result = parse(query, fieldsMap);
        const kibanaQuery = toKibanaQueryJSON(result);

        return this.buildQueryParameters(kibanaQuery, size);
    }

    protected buildQueryParameters(kibanaQuery, size: number) {
        const body = {
            query: kibanaQuery,
            sort: [
                {
                  "AuditInfo.JobMessageData.StartDateTime": {
                    "order": "desc"
                  }
                }
            ],
            size: size
        }
        if(this.search_after.length > 0) {
            body['search_after'] = this.search_after;
        }
        return body;
    }
}