import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { IPepGenericListDataSource, IPepGenericListPager, IPepGenericListParams, IPepGenericListSmartFilter } from "@pepperi-addons/ngx-composite-lib/generic-list";
import { AddonService } from 'src/app/services/addon.service';


@Component({
  selector: 'pending-actions',
  templateUrl: './pending-actions.component.html'
})
export class PendingActionsComponent implements OnInit {
  items: any[] = [];
  dashboardData;

  constructor(
    public addonService: AddonService
    ) { }

  ngOnInit() {
  }
  listDataSource: IPepGenericListDataSource = {
    
    init: async (parameters) => {
      this.dashboardData = await this.addonService.initHealthMonitorDashaboardData();
      this.items = (JSON.parse(this.dashboardData.PendingActions.List)).map((item) => {
        return {
          UUID: item['UUID'],
          AddonUUID: item['AuditInfo.JobMessageData.AddonData.AddonUUID'],
          CreationDateTime: item['CreationDateTime'],
          FunctionName: item['AuditInfo.JobMessageData.FunctionName'],
          Email: item['Event.User.Email'],
          NumberOfTry: item['AuditInfo.JobMessageData.NumberOfTry'],
          Status: item['Status.Name']
        }
      });

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
              FieldID: 'AddonUUID',
              Type: 'TextBox',
              Title: 'Addon Name',
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
              FieldID: 'FunctionName',
              Type: 'TextBox',
              Title: 'Function Name',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'Email',
              Type: 'TextBox',
              Title: 'Email',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'NumberOfTry',
              Type: 'TextBox',
              Title: 'Number Of Tries',
              Mandatory: true,
              ReadOnly: true
            },
            {
              FieldID: 'Status',
              Type: 'TextBox',
              Title: 'Status',
              Mandatory: true,
              ReadOnly: true
            }
          ],
          Columns: [
            {
              Width: 8
            },
            {
              Width: 14
            },
            {
              Width: 10
            },
            {
              Width: 10
            },
            {
              Width: 8
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
        totalCount: this.items.length
      });
    },
    update: async (params: any) => {
      let res = this.items
      return Promise.resolve(res);
    }
  }
  
}  
