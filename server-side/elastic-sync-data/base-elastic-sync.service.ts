import { Client } from '@pepperi-addons/debug-server/dist';
import { callElasticSearchLambda } from '@pepperi-addons/system-addon-utils';
import MonitorSettingsService from '../monitor-settings.service';
import { parse, toKibanaQueryJSON } from '@pepperi-addons/pepperi-filters';
import { AUDIT_LOG_INDEX } from '../entities';

export abstract class BaseElasticSyncService {
    protected monitorSettingsService = new MonitorSettingsService(this.client);
    protected params: { SearchAfter?: any[], FromIndex?: number, Where?: any };

    constructor(private client: Client, params: { SearchAfter?: any[], FromIndex?: number, Where?: any } = {}) {
        this.params = params;
    }

    protected abstract getSyncsResult();

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
            track_total_hits: true, // return total number of documents, for getting all items in the list
            size: size
        }
        if(this.params.SearchAfter && this.params.SearchAfter.length > 0) {
            body['search_after'] = this.params.SearchAfter;
        }
        if(this.params.FromIndex) {
            body['from'] = this.params.FromIndex;
        }
        return body;
    }

    protected createQueryTerm(field: string, value: string) {
        return {
            term: {
                [field]: value
            }
        }
    }

    // return a script checking if the creation date is not within the maintenance window hours (to exclude syncs created during maintenance window)
    protected getMaintenanceWindowHoursScript(maintenanceWindow: number[]) {
        return {
            bool: {
                must: {
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
            }
        }
    }

    protected async getMaintenanceWindowHours() {
        try {
            const maintenanceWindow = (await this.monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get()).MaintenanceWindow;
            return (maintenanceWindow.split(':')).map((item) => { return parseInt(item)} );
        } catch(err) {
            console.log(`error getting maintenance window: ${err}`);
        }
    }
}