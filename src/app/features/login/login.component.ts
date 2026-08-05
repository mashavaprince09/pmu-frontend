import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { toApiError } from '../../core/http/api-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  readonly username = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      await this.auth.login({ username: this.username(), password: this.password() });
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      const apiError = toApiError(err, 401);
      this.errorMessage.set(
        apiError.status === 401 ? 'Invalid username or password.' : apiError.message
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
