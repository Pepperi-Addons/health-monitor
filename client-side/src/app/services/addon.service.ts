import { AddonData } from '@pepperi-addons/papi-sdk';
import { Injectable } from '@angular/core';
import { config } from '../app.config';
import { PepAddonService, PepSessionService } from '@pepperi-addons/ngx-lib';
import { IPepGenericListParams } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { SmartFiltersSyncFields, SearchSyncFields, SmartFiltersInternalSyncFields, SearchInternalSyncFields } from '../entities';
import { ngxFilterToJsonFilter, parse, concat, JSONFilter } from '@pepperi-addons/pepperi-filters';

@Injectable({ providedIn: 'root' })
export class AddonService {

    filtersDistinctValues: any;

    constructor(
        public session:  PepSessionService,
        private addonService: PepAddonService
    ) {}

    async initHealthMonitorDashaboardData(): Promise<AddonData> {
        return await this.addonService.getAddonApiCall(config.AddonUUID, 'api', `health_monitor_dashboard?time_zone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`).toPromise();
    }

    async initChartsData(): Promise<AddonData> {
        return await this.addonService.postAddonApiCall(config.AddonUUID, 'api', `get_sync_aggregations_from_elastic`, { TimeZoneOffset: this.getTimeZoneOffset() }).toPromise();
    }

    async initSyncData(parameters: IPepGenericListParams, searchAfter: any[]) {
        const searchStringFields = ['UUID.keyword', 'Event.User.Email.keyword'];
        const searchBody = await this.getQueryParameters(parameters, searchAfter, searchStringFields, SmartFiltersSyncFields, SearchSyncFields);

        const smartFiltersSearchBody = { SearchBody: searchBody, DataType: 'SyncJob'};
        this.filtersDistinctValues = await this.getSmartFiletrsDistinctValues(smartFiltersSearchBody);

        return await this.addonService.postAddonApiCall(config.AddonUUID, 'api', `get_syncs_from_elastic`, searchBody).toPromise();
    }

    async getSmartFiletrsDistinctValues(searchBody) {
        const res = await this.addonService.postAddonApiCall(config.AddonUUID, 'api', 'get_smart_filters_from_elastic', searchBody).toPromise();
        return res;
    }

    async initInternalSyncData(parameters: IPepGenericListParams, searchAfter: any[]) {
        const searchStringFields = ['UUID.keyword'];
        const searchBody = await this.getQueryParameters(parameters, searchAfter, searchStringFields, SmartFiltersInternalSyncFields, SearchInternalSyncFields);

        const smartFiltersSearchBody = { SearchBody: searchBody, DataType: 'InternalSync'};
        this.filtersDistinctValues = await this.getSmartFiletrsDistinctValues(smartFiltersSearchBody);

        return await this.addonService.postAddonApiCall(config.AddonUUID, 'api', `get_internal_syncs_from_elastic`, searchBody).toPromise();
    }

    private getTimeZoneOffset() {
        return (new Date().getTimezoneOffset()) * (-1); // offset in minutes
    }

    private getQueryParameters(params: IPepGenericListParams, searchAfter: any[],searchStringFields: string[], SmartFiltersSyncFields, SearchFields) {
        const pageSize = (params.toIndex - params.fromIndex) + 1 || 100;
        const page = params.pageIndex || (params.fromIndex / pageSize) || 0;
        const fromIndex = pageSize * page;

        let options = {
            FromIndex: fromIndex,
            SearchAfter: searchAfter,
            Where: this.getWhereClause(params, searchStringFields, SmartFiltersSyncFields, SearchFields)
        };

        return options;
    }

    private getWhereClause(params: IPepGenericListParams, searchStringFields: string[], SmartFiltersSyncFields, SearchFields): undefined | JSONFilter {
        let filtersJson: JSONFilter;
        let searchJson: JSONFilter;

        if (params.searchString) {
            searchJson = this.getSearchString(params, searchStringFields, SearchFields);
        }

        if (params.filters) {
            filtersJson = this.getFiltersString(params, SmartFiltersSyncFields);
        }

        if(searchJson && filtersJson) {
            return concat(true, searchJson, filtersJson);
        } else if(searchJson || filtersJson) {
            return searchJson ?? filtersJson;
        }
    }

    private getSearchString(params, searchStringFields: string[], SearchFields): JSONFilter {
        const typesMapping = this.getTypesMapping(SearchFields);

        let whereArray = [];
        searchStringFields.forEach((field: string) => {
            whereArray.push(`${field} LIKE "%${params.searchString}%"`);
        })

        const filters = `(${whereArray.join(' OR ')})`;
        return parse(filters, typesMapping);
    }

    getFiltersString(params, SmartFiltersSyncFields): JSONFilter {
        const typesMapping = this.getTypesMapping(SmartFiltersSyncFields);
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
