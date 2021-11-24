import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ObjectSingleData, PepDataConvertorService,
    PepRowData, PepFieldData, FIELD_TYPE } from '@pepperi-addons/ngx-lib';
import { PepListComponent} from '@pepperi-addons/ngx-lib/list';
import { AppService } from "../app.service";
import { PepDialogService,PepDialogActionButton} from "@pepperi-addons/ngx-lib/dialog";
import { PepDialogData } from "@pepperi-addons/ngx-lib/dialog";

@Component({
  selector: 'app-pepperi-health-monitor-settings',
  templateUrl: './pepperi-health-monitor-settings.component.html',
  styleUrls: ['./pepperi-health-monitor-settings.component.scss']
})
export class PepperiHealthMonitorSettingsComponent implements OnInit {

  @ViewChild(PepListComponent) customList: PepListComponent;
  tests;
  menuActions = [
    { key: 'edit', text: 'Edit'}, 
    { key: 'run_now', text: 'Run Now'}, 
    { key: 'send_test_message', text: 'Send Test Message'}
  ];
  disableActions =true;


  constructor(
      private translate: TranslateService,
      private dataConvertorService: PepDataConvertorService,
      private appService: AppService,
      private dialogService: PepDialogService
  ) {

      const browserCultureLang = translate.getBrowserCultureLang();
  }

  ngOnInit() {
  }

  onMenuItemClicked(event) {
    const action = event.source;
    const typeListID = this.customList.getSelectedItemsData().rows[0];
    const typeData = this.customList.getItemDataByID(typeListID.toString());
    var typeID = typeData.Fields[0].AdditionalValue;

    if (action.key == 'edit') {
      window.location.href =window.location.origin + `/settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/health-monitor-settings-edit?Type=`+typeID;
    }
    else {
      this.appService.postAddonServerAPI('api',action.key,{Type:typeID},{})
        .subscribe((result: any) => {
        const popupMessage = result;
        const eventName = action.value;
        this.openDialog("Info",popupMessage);
      });
    }
  }

  openDialog(title: string, content: string, callback?: any) {
    const actionButton: PepDialogActionButton = {
      title: "OK",
      className: "",
      callback: callback,
    };
 
    const dialogData = new PepDialogData({
      title: title,
      content: content,
      actionButtons: [actionButton],
      actionsType: "custom",
    });
    this.dialogService
      .openDefaultDialog(dialogData)
      .afterClosed()
      .subscribe((callback) => {
      });
  }

  ngAfterViewInit() {
      this.loadlist('all');
  }

  loadlist(apiEndpoint) {
      this.appService.getAddonServerAPI('api','health_monitor_settings',{})
      .subscribe((result: any) => {
        this.tests =  result;
        this.loadAddons(this.tests);
      });
  }

  loadAddons(tests) {
      if (this.customList && tests) {
          const tableData = new Array<PepRowData>();
          tests.forEach((test: any) => {
              const allKeys = ['Type', 'Webhook'];//['Type', 'Email', 'Webhook'];
              tableData.push(this.convertTestToPepRowData(test, allKeys));
          });
          const pepperiListObj = this.dataConvertorService.convertListData(tableData);
          // const buffer = [];
          // if (pepperiListObj.Rows) {
          //     pepperiListObj.Rows.forEach( row => {
          //         const osd = new ObjectSingleData(pepperiListObj.UIControl, row);
          //         osd.IsEditable = true;
          //         buffer.push(osd);
          //     });
          // }
          // this.customList.initListData(pepperiListObj.UIControl, buffer.length, buffer);

          const uiControl = this.dataConvertorService.getUiControl(tableData[0]);
          this.customList.initListData(uiControl, pepperiListObj.length, pepperiListObj);
      }
  }

  convertTestToPepRowData(test: any, customKeys = null) {
      const row = new PepRowData();
      row.Fields = [];
      const keys = customKeys ? customKeys : Object.keys(test);
      keys.forEach(key => row.Fields.push(this.initDataRowField(test, key)));
      return row;
  }

  initDataRowField(test: any, key: any): PepFieldData {

      const dataRowField: PepFieldData = {
          ApiName: key,
          Title: this.translate.instant(key),
          XAlignment: 1,
          FormattedValue: test[key] ? test[key].toString() : '',
          Value:  test[key] ? test[key].toString() : '',
          ColumnWidth: 10,
          AdditionalValue: '',
          OptionalValues: [],
          FieldType: FIELD_TYPE.TextBox
      };

      switch (key) {

          case 'Type':
              dataRowField.ColumnWidth = 13;
              dataRowField.AdditionalValue= test["ID"] ? test["ID"].toString() : '';
              break;
          case 'Email':
              dataRowField.ColumnWidth = 50;
              break;
          case 'Webhook':
              dataRowField.ColumnWidth = 60;
              break;
          default:
              dataRowField.ColumnWidth = 0;
              break;
      }

      return dataRowField;
  }

  onListChange(event) {
  }

  onCustomizeFieldClick(event) {
  }

  selectedRowsChanged(selectedRowsCount) {
    if (selectedRowsCount==0){
      this.disableActions=true;
    }
    else{
      this.disableActions=false;
    }
  }

}