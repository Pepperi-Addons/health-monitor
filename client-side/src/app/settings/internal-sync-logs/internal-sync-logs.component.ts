import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { IPepGenericListDataSource, IPepGenericListPager, IPepGenericListParams, IPepGenericListSmartFilter } from "@pepperi-addons/ngx-composite-lib/generic-list";
import { AddonService } from 'src/app/services/addon.service';


@Component({
  selector: 'internal-sync-logs',
  templateUrl: './internal-sync-logs.component.html',
  styleUrls: ['./internal-sync-logs.component.scss']
})
export class InternalSyncLogsComponent implements OnInit {
  items: any[] = [];
  searchAfter: any[] = [];
  smartFilter: IPepGenericListSmartFilter;
  size: number;

  pager: IPepGenericListPager = {
    type: 'pages',
    size: 50,
    index: 0
};

  constructor(
    public addonService: AddonService
    ) { }

  ngOnInit() {
  }

  listDataSource: IPepGenericListDataSource = {
    init: async (parameters: IPepGenericListParams) => {
      const items = await this.addonService.initInternalSyncData(parameters, this.searchAfter);
      this.size = items.size;
      this.items = this.fixAuditLogSyncs(items);
      this.smartFilter = this.getSmartFilters(parameters);

      return Promise.resolve({
        dataView: {
          Context: {
            Name: '',
            Profile: { InternalID: 0 },
            ScreenSize: 'Landscape'
          },
          Type: 'Grid',
          Title: 'Health Monitor Dashboard',
          Fields: [
            {
              FieldID: 'UUID',
              Type: 'TextBox',
              Title: 'UUID',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'StartDateTime',
              Type: 'DateAndTime',
              Title: 'Date & Time',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'Status',
              Type: 'TextBox',
              Title: 'Status',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'NumberOfTry',
              Type: 'TextBox',
              Title: 'Number Of Try',
              Mandatory: true,
              ReadOnly: true
            },
          ],
          Columns: [
            {
              Width: 10
            },
            {
              Width: 10
            },
            {
              Width: 10
            },
            {
              Width: 10
            }
          ],
          FrozenColumnsCount: 0,
          MinimumColumnWidth: 0
        },
        items: this.items,
        totalCount: this.size
      });
    },
    update: async (params: any) => {
      let items = await this.addonService.initSyncData(params, this.searchAfter);
      this.searchAfter = items.searchAfter;
      this.size = items.size;
      this.items = this.fixAuditLogSyncs(items);

      return Promise.resolve(this.items);
    }
  }

  fixAuditLogSyncs(items) {
    return items.data.map((item) => {
      return {
        UUID: item.UUID,
        StartDateTime: item.StartDateTime,
        Status: item.Status,
        NumberOfTry: item.NumberOfTry
      }
    });
  }
  
  getSmartFilters(parameters: IPepGenericListParams): IPepGenericListSmartFilter {
    return {
        dataView: {
            Context: {
                Name: '',
                Profile: { InternalID: 0 },
                ScreenSize: 'Landscape'
            },
            Type: 'Menu',
            Title: '',
            Fields: [
                {
                    FieldID: 'Status.Name.keyword',
                    Type: 'MultipleStringValues',
                    Title: 'Status',
                    OptionalValues: []
                },
                {
                    FieldID: 'AuditInfo.JobMessageData.StartDateTime',
                    Type: 'DateTime',
                    Title: 'Date & Time'
                },
                {
                    FieldID: 'AuditInfo.JobMessageData.NumberOfTry',
                    Type: 'Integer',
                    Title: 'Number Of Try'
                }
            ],
            FrozenColumnsCount: 0,
            MinimumColumnWidth: 0
        } as any,
        data: parameters.filters
    }
  }
}  