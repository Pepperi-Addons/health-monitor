import { AddonData } from '@pepperi-addons/papi-sdk';
import { Injectable } from '@angular/core';
import { config } from '../app.config';
import { PepAddonService, PepSessionService } from '@pepperi-addons/ngx-lib';
import { IPepGenericListParams } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { SmartFiltersFields, SearchFields } from '../entities';
import { ngxFilterToJsonFilter, parse, concat, JSONFilter } from '@pepperi-addons/pepperi-filters';

@Injectable({ providedIn: 'root' })
export class AddonService {

    filtersDistinctValues: any;

    constructor(
        public session:  PepSessionService,
        private addonService: PepAddonService
    ) {}

    async initHealthMonitorDashaboardData(): Promise<AddonData> {
        return await this.addonService.getAddonApiCall(config.AddonUUID, 'api', `health_monitor_dashboard`).toPromise();
    }

    async initChartsData(): Promise<AddonData> {
        return await this.addonService.getAddonApiCall(config.AddonUUID, 'api', `get_sync_aggregations_from_elastic`).toPromise();
    }

    async initSyncData(parameters: IPepGenericListParams, searchAfter: any[]) {
        const searchBody = await this.getQueryParameters(parameters, searchAfter);
        return await this.addonService.postAddonApiCall(config.AddonUUID, 'api', `get_syncs_from_elastic`, searchBody).toPromise();
    }

    private getQueryParameters(params: IPepGenericListParams, searchAfter: any[]) {
        const pageSize = (params.toIndex - params.fromIndex) + 1 || 100;
        const page = params.pageIndex || (params.fromIndex / pageSize) || 0;
        const fromIndex = pageSize * page;

        let options = {
            FromIndex: fromIndex,
            SearchAfter: searchAfter,
            Where: this.getWhereClause(params)
        };

        return options;
    }

    private getWhereClause(params: IPepGenericListParams): undefined | JSONFilter {
        let filtersJson: JSONFilter;
        let searchJson: JSONFilter;

        if (params.searchString) {
            searchJson = this.getSearchString(params);
        }

        if (params.filters) {
            filtersJson = this.getFiltersString(params);
        }

        if(searchJson && filtersJson) {
            return concat(true, searchJson, filtersJson);
        } else if(searchJson || filtersJson) {
            return searchJson ?? filtersJson;
        }
    }

    private getSearchString(params): JSONFilter {
        const typesMapping = this.getTypesMapping(SearchFields);

        const searchStringFields = ['UUID.keyword', 'Event.User.Email.keyword'];
        let whereArray = [];
        searchStringFields.forEach((field: string) => {
            whereArray.push(`${field} LIKE "%${params.searchString}%"`);
        })

        const filters = `(${whereArray.join(' OR ')})`;
        return parse(filters, typesMapping);
    }

    getFiltersString(params): JSONFilter {
        const typesMapping = this.getTypesMapping(SmartFiltersFields);
        return ngxFilterToJsonFilter(params.filters, typesMapping);
    }

    getTypesMapping(requestedFields) {
        const typesMapping: { [name: string]: any } = {};
        Object.entries(requestedFields).forEach(([key, value]) => {
            typesMapping[key] = value;
        });
        return typesMapping;
    }
}
