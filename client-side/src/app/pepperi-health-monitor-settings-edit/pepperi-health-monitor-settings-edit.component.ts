import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PepFieldClickedData, PepFieldValueChangedData } from '@pepperi-addons/ngx-lib';
import { AppService } from "../app.service";
import {DialogService,PepDialogActionButton} from "@pepperi-addons/ngx-lib/dialog";
import { PepDialogData } from "@pepperi-addons/ngx-lib/dialog";
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-pepperi-health-monitor-settings-edit',
  templateUrl: './pepperi-health-monitor-settings-edit.component.html',
  styleUrls: ['./pepperi-health-monitor-settings-edit.component.scss']
})
export class PepperiHealthMonitorSettingsEditComponent implements OnInit {
  type;
  typeData;
  isSupport; 

  constructor(      
    private translate: TranslateService,
    private appService: AppService,
    private dialogService: DialogService,
    private route: ActivatedRoute ) { }

  ngOnInit() {
    let params = (new URL(window.location.href)).searchParams;
    this.type = params.get("Type");
    this.isSupport = params.get("support_user")==null? false: (params.get("support_user")=="true");

    //this.type = this.route.snapshot.params.Type;
    //this.isSupport = this.route.snapshot.params["support_user"]; 

    this.appService.postAddonServerAPI('api','health_monitor_type_alert_edit',{Type:this.type},{})
    .subscribe((result: any) => {
      this.typeData = result;
    });
  }

  onBack() {
    window.location.href =window.location.origin + '/settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/health-monitor-settings';
  }

  onSave() {
    this.typeData.Type = this.type;
     this.appService.postAddonServerAPI('api','health_monitor_type_alert_save',this.typeData,{})
    .subscribe((result: any) => {
      const response =result;
      if (response.Success){
        window.location.href =window.location.origin + '/settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/health-monitor-settings';
      }
      else{
        this.openDialog("Error",response.ErrorMessage)
      }
    });
    
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
      type: "custom",
    });
    this.dialogService
      .openDefaultDialog(dialogData)
      .afterClosed()
      .subscribe((callback) => {
      });
  }

  onValueChanged(event: PepFieldValueChangedData) {
    this.typeData[event.key] =event.value;
  }

}
