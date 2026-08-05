import { Component, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ControlBarComponent } from './control-bar/control-bar.component';
import { TrendPanelComponent } from './trend-panel/trend-panel.component';
import { WaveformChartComponent } from './waveform-chart/waveform-chart.component';
import { DashboardStore } from '../../core/state/dashboard-store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ControlBarComponent, TrendPanelComponent, WaveformChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private syncingFromRoute = false;

  constructor(
    readonly store: DashboardStore,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    effect(() => {
      // touch signals so this effect re-runs on every param change
      const params = this.store.toQueryParams();
      if (this.syncingFromRoute) return;
      this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
    });
  }

  ngOnInit(): void {
    this.syncingFromRoute = true;
    this.store.loadFromQueryParams(this.route.snapshot.queryParams);
    this.syncingFromRoute = false;
  }
}
