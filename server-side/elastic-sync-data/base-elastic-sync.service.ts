import { Client } from '@pepperi-addons/debug-server/dist';
import { callElasticSearchLambda } from '@pepperi-addons/system-addon-utils';
import MonitorSettingsService from '../monitor-settings.service';
import { parse, toKibanaQueryJSON } from '@pepperi-addons/pepperi-filters';

const indexName = 'audit_log';

export abstract class BaseElasticSyncService {
    protected monitorSettingsService = new MonitorSettingsService(this.client);
    constructor(private client: Client) {}

    protected abstract getSyncsResult(res);

    protected abstract fixElasticResultObject(res);

    protected async getElasticData(requestBody) {
        const elasticEndpoint = `${indexName}/_search`;

        try{
            console.log(`About to search data in elastic`);
            const res = await callElasticSearchLambda(elasticEndpoint, 'POST', requestBody );
            console.log("Successfully got data from elastic.");
            return res;
        } catch(err){
            throw new Error(`Could not search data in elastic, error: ${err}`);
        }
    }

    protected getElasticBody(query: string, fieldsMap, size: number, search_after?: number[]) {
        const result = parse(query, fieldsMap);
        const kibanaQuery = toKibanaQueryJSON(result);

        return this.buildQueryParameters(kibanaQuery, size, search_after);
    }

    protected buildQueryParameters(kibanaQuery, size: number, search_after?: number[]) {
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
        if(search_after) {
            body['search_after'] = search_after;
        }
        return body;
    }
}