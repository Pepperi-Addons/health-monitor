import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Chart, registerables } from "chart.js";
import { AddonService } from 'src/app/services/addon.service';


@Component({
  selector: 'sync-dashboard',
  templateUrl: './sync-dashboard.component.html',
  styleUrls: ['./sync-dashboard.component.scss']
})
export class SyncDashboardComponent implements OnInit {
  syncData;
  dashboardData;
  ctxSyncStatus: any;
  ctxDailySync: any;
  ctxHourlySync: any;
  ctxWeeklySync: any;
  ctxMonthlySync: any;

  isLoaded: boolean = false;
  syncEmpty: boolean = true;

  tabID = 0;

  items: any[] = [];

  @ViewChild('hourlySync') canvasHourlySync: ElementRef;
  @ViewChild('dailySync') canvasDailySync: ElementRef;
  @ViewChild('weeklySync') canvasWeeklySync: ElementRef;
  @ViewChild('monthlySync') canvasMonthlySync: ElementRef;

  constructor(
    public addonService: AddonService
  ) {
    Chart.register(...registerables);
    Chart.defaults.maintainAspectRatio = false;
  }

  ngOnInit() {
    this.addonService.initChartsData().then((result: any) => {
      this.dashboardData = result.DashboardData;
      this.dashboardData.LastSync.StatusName = result.DashboardData.LastSync.Status ? 'Success' : 'Delayed';
      this.dashboardData.LastSync.Color = result.DashboardData.LastSync.Status ? 'inherit' : 'rgba(255, 89, 90, 1)';

      this.syncData = result;
      this.syncEmpty = Object.keys(this.syncData).length === 0;
      this.isLoaded = true;
      if (!this.syncEmpty) {
        this.loadData();
      }
    });
  }

  loadData() {
    const ctxTable = {
      LastDaySyncs: this.ctxDailySync = this.canvasDailySync.nativeElement.getContext('2d'),
      WeeklySyncs: this.ctxWeeklySync = this.canvasWeeklySync.nativeElement.getContext('2d'),
      MonthlySyncs: this.ctxMonthlySync = this.canvasMonthlySync.nativeElement.getContext('2d')
    }

    Object.entries(this.syncData).forEach(([key, value]: [string, any]) => {
      if (key !== 'DashboardData') {
        if (key === 'HourlySyncs') {
          this.loadHourlySync();
        } else {
          this.ctxDailySync = this.canvasDailySync.nativeElement.getContext('2d');

          const syncsData = (key === 'LastDaySyncs') ?
            value.data.map((item) => { return [item] }) : value.data[0].map((_, colIndex) => value.data.map(row => row[colIndex]));

          this.loadAggregatedSyncStatus(this.syncData[key].dates, ctxTable[key], syncsData);
        }
      }
    });
  }

  loadHourlySync() {
    this.ctxHourlySync = this.canvasHourlySync.nativeElement.getContext('2d');
    const data = this.syncData.HourlySyncs.data[0].map((_, colIndex) => this.syncData.HourlySyncs.data.map(row => row[colIndex]));

    return new Chart(this.ctxHourlySync, {
      type: 'line',
      data: {
        labels: this.syncData.HourlySyncs.dates,
        datasets: [{
          label: "Success",
          data: data[2],
          borderColor: 'rgba(144, 238, 144)', // green
          backgroundColor: 'rgb(144, 238, 144)',
        },
        {
          label: "Failed",
          data: data[1],
          borderColor: 'rgb(255, 0, 0)', // red
          backgroundColor: 'rgb(255, 0, 0)',
        },
        {
          label: "Delayed",
          data: data[0],
          borderColor: 'rgb(255, 165, 0)', // orange
          backgroundColor: 'rgb(255, 165, 0)',
        }]
      },
      options: {
        animation: {
          duration: 0 // general animation time
        },
        elements: {
          line: {
            tension: 0 // disables bezier curves
          }
        },
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true,
            mode: 'x',
            intersect: false,
            position: 'nearest'
          }
        }
      }

    });
  }

  loadAggregatedSyncStatus(dates, context, data) {
    return new Chart(context, {
      type: 'bar',
      data: {
        labels: dates || [''],
        datasets: [{
          label: "Success",
          data: data[2],
          backgroundColor: 'rgba(144, 238, 144)',
          borderWidth: 1,
          barThickness: 30
        },
        {
          label: "Delayed",
          data: data[0],
          backgroundColor: 'rgb(255, 165, 0)',
          borderWidth: 1,
          barThickness: 30
        },
        {
          label: "Failed",
          data: data[1],
          backgroundColor: 'rgb(255, 0, 0)',
          borderWidth: 1,
          barThickness: 30
        }]
      },
      options: {
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true,
            mode: 'x',
            intersect: false,
            position: 'nearest'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true
          },
          x: {
            stacked: true
          }
        },
      }
    });
  }

}  
