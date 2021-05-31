import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PepListComponent, ChangeSortingEvent } from '@pepperi-addons/ngx-lib/list';
import { CustomizationService, HttpService, ObjectSingleData, DataConvertorService,
  PepRowData, PepFieldData, AddonService, FIELD_TYPE, UtilitiesService } from '@pepperi-addons/ngx-lib';
import { AppService } from "../app.service";
import { Chart } from "chart.js";

@Component({
  selector: 'app-pepperi-health-monitor-dashboard',
  templateUrl: './pepperi-health-monitor-dashboard.component.html',
  styleUrls: ['./pepperi-health-monitor-dashboard.component.scss']
})
export class PepperiHealthMonitorDashboardComponent implements OnInit {
  dashboardData;
  ctxSyncStatus: any;
  ctxDailySync: any;
  tabID = 0;

  @ViewChild ('syncStatus') canvasSyncStatus: ElementRef;
  @ViewChild ('dailySync') canvasDailySync: ElementRef;
  @ViewChild(PepListComponent) customList: PepListComponent;

  constructor(private translate: TranslateService,
    private appService: AppService,
    private dataConvertorService: DataConvertorService) { }

  ngOnInit() {
    this.appService.getAddonServerAPI('api','health_monitor_dashboard',{})
      .subscribe((result: any) => {
      this.dashboardData = result;
      this.loadData();
      this.loadList();
    });
  }

  loadData() {
      Chart.defaults.global.maintainAspectRatio = false;
      // this.canvasSyncStatus = document.getElementById('syncStatus');
      this.ctxSyncStatus = this.canvasSyncStatus.nativeElement.getContext('2d');
      const syncStatus = new Chart(this.ctxSyncStatus, {
        type: 'doughnut',
        data: {
        labels: ['SUCCESS', 'DELAYED'],
        datasets: [{
          data: [this.dashboardData.SyncStatus.Success, this.dashboardData.SyncStatus.Delayed],
          backgroundColor: [
            'rgba(75, 220, 172, 0.7)',
            'rgba(255, 89, 90, 0.7)'],
          hoverBackgroundColor: [
            'rgba(75, 220, 172, 1)',
            'rgba(255, 89, 90, 1)']
          }]
        }}
      );

      this.ctxDailySync = this.canvasDailySync.nativeElement.getContext('2d');
      const dailySync = new Chart(this.ctxDailySync, {
        type: 'line',
        data: {
          labels: this.dashboardData.DailySync.Labels,
          datasets: [
            {
              label:'Success',
              fill: false,
              lineTension: 0.1,
              backgroundColor: 'rgba(75, 220, 172, 0.7)',
              borderColor: 'rgba(75, 220, 172, 1)',
              borderCapStyle: 'butt',
              borderDash: [],
              borderDashOffset: 0.0,
              borderJoinStyle: 'miter',
              pointBorderColor: 'rgba(75, 220, 172, 1)',
              pointBackgroundColor: '#fff',
              pointBorderWidth: 1,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: 'rgba(75, 220, 172, 1)',
              pointHoverBorderColor: 'rgba(220,220,220,1)',
              pointHoverBorderWidth: 2,
              pointRadius: 1,
              pointHitRadius: 10,
              data: this.dashboardData.DailySync.Success,
              spanGaps: false,
            },
            {
              label:'Delayed',
              fill: false,
              lineTension: 0.1,
              backgroundColor: 'rgba(255, 89, 90, 0.7)',
              borderColor: 'rgba(255, 89, 90, 1)',
              borderCapStyle: 'butt',
              borderDash: [],
              borderDashOffset: 0.0,
              borderJoinStyle: 'miter',
              pointBorderColor: 'rgba(255, 89, 90, 1)',
              pointBackgroundColor: '#fff',
              pointBorderWidth: 1,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: 'rgba(255, 89, 90, 1)',
              pointHoverBorderColor: 'rgba(220,220,220,1)',
              pointHoverBorderWidth: 2,
              pointRadius: 1,
              pointHitRadius: 10,
              data: this.dashboardData.DailySync.Delayed,
              spanGaps: false,
            }
          ]
        }
      });

      this.dashboardData.LastSync.StatusName = this.dashboardData.LastSync.Status? 'Success' : 'Delayed';
      this.dashboardData.LastSync.Color = this.dashboardData.LastSync.Status? 'inherit' : 'rgba(255, 89, 90, 1)'; 
      this.dashboardData.JobTimeUsage.Color = this.dashboardData.JobTimeUsage.Percantage <80 ? 'inherit' : 'rgba(255, 89, 90, 1)';
    }

  loadList() {
    const actionsList = JSON.parse(this.dashboardData.PendingActions.List);
    this.loadAddons(actionsList);
  }

  loadAddons(pendingActions) {
      if (this.customList && pendingActions) {
          const tableData = new Array<PepRowData>();
          pendingActions.forEach((action: any) => {
              const allKeys = ['AuditInfo.JobMessageData.AddonData.AddonUUID','UUID','CreationDateTime', 'AuditInfo.JobMessageData.FunctionName', 'Event.User.Email','AuditInfo.JobMessageData.NumberOfTry','Status.Name'];
              tableData.push(this.convertTestToPepRowData(action, allKeys));
          });
          const pepperiListObj = this.dataConvertorService.convertListData(tableData);
          const buffer = [];
          if (pepperiListObj.Rows) {
              pepperiListObj.Rows.forEach( row => {
                  const osd = new ObjectSingleData(pepperiListObj.UIControl, row);
                  osd.IsEditable = true;
                  buffer.push(osd);
              });
          }

          this.customList.initListData(pepperiListObj.UIControl, buffer.length, buffer, 'table', '', true);
      }
  }

  convertTestToPepRowData(action: any, customKeys = null) {
      const row = new PepRowData();
      row.Fields = [];
      const keys = customKeys ? customKeys : Object.keys(action);
      keys.forEach(key => row.Fields.push(this.initDataRowField(action, key)));
      return row;
  }

  initDataRowField(action: any, key: any): PepFieldData {

      const dataRowField: PepFieldData = {
          ApiName: key,
          Title: this.translate.instant(key),
          XAlignment: 1,
          FormattedValue: action[key] ? action[key].toString() : '',
          Value:  action[key] ? action[key].toString() : '',
          ColumnWidth: 10,
          AdditionalValue: '',
          OptionalValues: [],
          FieldType: FIELD_TYPE.TextBox
      };

      switch (key) {
          case 'AuditInfo.JobMessageData.AddonData.AddonUUID':
            dataRowField.Title = "Addon Name";  
            dataRowField.ColumnWidth = 8;
            break;
          case 'UUID':
            dataRowField.ColumnWidth = 14;
            break;
          case 'CreationDateTime':
            dataRowField.Title = "Creation Date Time";
            dataRowField.ColumnWidth = 10;
            break;
          case 'AuditInfo.JobMessageData.FunctionName':
            dataRowField.Title = "Function Name";
            dataRowField.ColumnWidth = 10;
            break;
          case 'Event.User.Email':
            dataRowField.Title = "Email";
            dataRowField.ColumnWidth = 8;
            break;
          case 'AuditInfo.JobMessageData.NumberOfTry':
            dataRowField.Title = "Number Of Tries";
            dataRowField.ColumnWidth = 10;
            break;
          case 'Status.Name':
            dataRowField.Title = "Status";
            dataRowField.ColumnWidth = 10;
            break;
          default:
            dataRowField.ColumnWidth = 0;
            break;
      }

      return dataRowField;
  }

  tabClick(event){
    window.dispatchEvent(new Event("resize"));
    this.tabID = event.index;
  }

  onListChange(event) {
  }

  onCustomizeFieldClick(event) {
  }

}
