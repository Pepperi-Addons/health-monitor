import { Component, OnInit } from '@angular/core';
import { AddonService } from 'src/app/services/addon.service';


@Component({
  selector: 'kpi-dashboard',
  templateUrl: './kpi-dashboard.component.html',
  styleUrls: ['./kpi-dashboard.component.scss']
})
export class KPIDashboardComponent implements OnInit {
  dashboardData;
  uptimeValues: any;

  constructor(
    public addonService: AddonService
  ) {}

  ngOnInit() {
    this.addonService.initKpiTabData().then(result => {
      if(result && result?.UptimeSync !== '') {
        this.dashboardData = result;
        this.uptimeValues = Object.values(this.dashboardData?.UptimeSync?.data);
      }
    });
  }
}  
