import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { IPepGenericListDataSource } from "@pepperi-addons/ngx-composite-lib/generic-list";
import { AddonService } from 'src/app/services/addon.service';


@Component({
  selector: 'app-pepperi-health-monitor-dashboard',
  templateUrl: './pepperi-health-monitor-dashboard.component.html',
  styleUrls: ['./pepperi-health-monitor-dashboard.component.scss']
})
export class PepperiHealthMonitorDashboardComponent implements OnInit {
  monitorLevel: number;
  tabID = 0;
  isLoaded: boolean = false;

  constructor(
    public addonService: AddonService
    ) { }

  ngOnInit() {
    this.init();
  }

  async init() {
    this.monitorLevel = await this.addonService.getMonitorLevel();
    this.isLoaded = true;
  }

  tabClick(event){
    window.dispatchEvent(new Event("resize"));
    this.tabID = event.index;
  }
}  
