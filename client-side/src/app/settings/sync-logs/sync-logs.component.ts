import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { IPepGenericListDataSource, IPepGenericListPager, IPepGenericListParams, IPepGenericListSmartFilter } from "@pepperi-addons/ngx-composite-lib/generic-list";
import { AddonService } from 'src/app/services/addon.service';


@Component({
  selector: 'sync-logs',
  templateUrl: './sync-logs.component.html',
  styleUrls: ['./sync-logs.component.scss']
})
export class SyncLogsComponent implements OnInit {
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
      const items = await this.addonService.initSyncData(parameters, this.searchAfter);
      this.size = items.size || 0;
      this.items = items.data || [];
      if(this.size > 0){
        this.smartFilter = this.getSmartFilters(parameters);
      }

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
              FieldID: 'CreationDateTime',
              Type: 'DateAndTime',
              Title: 'Creation Date Time',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'ModificationDateTime',
              Type: 'DateAndTime',
              Title: 'Modification Date Time',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'User',
              Type: 'TextBox',
              Title: 'User',
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
            {
              FieldID: 'PepperiVersion',
              Type: 'TextBox',
              Title: 'Pepperi Version',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'Device',
              Type: 'TextBox',
              Title: 'Device',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'OSVersion',
              Type: 'TextBox',
              Title: 'OS Version',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'DeviceID',
              Type: 'TextBox',
              Title: 'Device ID',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'ClientType',
              Type: 'TextBox',
              Title: 'Client Type',
              Mandatory: true,
              ReadOnly: true
            },
          ],
          Columns: [
            {
              Width: 15
            },
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
            },
            {
              Width: 5
            },
            {
              Width: 5
            },
            {
              Width: 10
            },
            {
              Width: 5
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
      this.items = items.data;

      return Promise.resolve(this.items);
    }
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
                    OptionalValues: this.addonService.filtersDistinctValues.StatusNames
                },
                {
                    FieldID: 'Event.User.Email.keyword',
                    Type: 'MultipleStringValues',
                    Title: 'User',
                    OptionalValues: this.addonService.filtersDistinctValues.UserNames
                },
                {
                    FieldID: 'CreationDateTime',
                    Type: 'DateTime',
                    Title: 'Creation time'
                },
                {
                    FieldID: 'ModificationDateTime',
                    Type: 'DateTime',
                    Title: 'Modification time'
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
