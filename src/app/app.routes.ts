import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';
import { SchedulePage } from './features/schedule/schedule-page';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'schedule',
  },
  {
    // Not lazy: it is the landing page, and loading it in a second chunk means
    // painting the shell around an empty page and pushing the footer down when
    // the grid finally arrives.
    path: 'schedule',
    title: 'Schedule — Booking Desk',
    component: SchedulePage,
  },
  {
    path: 'book',
    title: 'New booking — Booking Desk',
    loadComponent: () => import('./features/book/booking-page').then((m) => m.BookingPage),
  },
  {
    path: 'bookings',
    title: 'My bookings — Booking Desk',
    loadComponent: () => import('./features/bookings/my-bookings-page').then((m) => m.MyBookingsPage),
  },
  {
    path: 'admin',
    title: 'All bookings — Booking Desk',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-page').then((m) => m.AdminPage),
  },
  {
    path: 'no-access',
    title: 'No access — Booking Desk',
    loadComponent: () => import('./features/no-access/no-access-page').then((m) => m.NoAccessPage),
  },
  {
    path: '**',
    redirectTo: 'schedule',
  },
];
