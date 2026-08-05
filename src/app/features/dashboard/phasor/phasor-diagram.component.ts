import { AfterViewInit, Component, ElementRef, ViewChild, effect, input } from '@angular/core';
import { CHANNEL_COLORS } from '../../../core/chart-colors';
import { Phasor } from '../../../core/dsp/phasor.service';

@Component({
  selector: 'app-phasor-diagram',
  standalone: true,
  imports: [],
  template: `<canvas #canvas width="260" height="260"></canvas>`,
  styleUrl: './phasor-diagram.component.scss'
})
export class PhasorDiagramComponent implements AfterViewInit {
  readonly phasors = input<Phasor[]>([]);

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private viewReady = false;

  constructor() {
    effect(() => {
      const data = this.phasors();
      if (!this.viewReady) return;
      this.draw(data);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.draw(this.phasors());
  }

  private draw(phasors: Phasor[]): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 24;

    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    // Grid circles
    for (const frac of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(center, center, radius * frac, 0, 2 * Math.PI);
      ctx.stroke();
    }
    // Axes
    ctx.beginPath();
    ctx.moveTo(center - radius, center);
    ctx.lineTo(center + radius, center);
    ctx.moveTo(center, center - radius);
    ctx.lineTo(center, center + radius);
    ctx.stroke();

    if (phasors.length === 0) return;

    const maxMag = Math.max(...phasors.map((p) => p.magnitude), 1e-9);

    for (const p of phasors) {
      const len = (p.magnitude / maxMag) * radius;
      // Screen y is inverted; rotate so 0 rad points right and increases counter-clockwise.
      const x = center + len * Math.cos(p.phaseRad);
      const y = center - len * Math.sin(p.phaseRad);

      ctx.strokeStyle = CHANNEL_COLORS[p.channel] ?? '#e2e8f0';
      ctx.fillStyle = CHANNEL_COLORS[p.channel] ?? '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.font = '10px sans-serif';
      ctx.fillText(p.channel, x + 6, y - 6);
    }
  }
}
