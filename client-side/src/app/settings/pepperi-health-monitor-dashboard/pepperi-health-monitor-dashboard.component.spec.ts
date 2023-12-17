import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PepperiHealthMonitorDashboardComponent } from './pepperi-health-monitor-dashboard.component';

describe('PepperiHealthMonitorDashboardComponent', () => {
  let component: PepperiHealthMonitorDashboardComponent;
  let fixture: ComponentFixture<PepperiHealthMonitorDashboardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PepperiHealthMonitorDashboardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PepperiHealthMonitorDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
