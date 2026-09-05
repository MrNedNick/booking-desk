import { HttpBackend, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ANIMATION_MODULE_TYPE,
  EnvironmentProviders,
  Provider,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Router, provideRouter } from '@angular/router';
import { RenderResult, render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { identityInterceptor } from './core/identity.interceptor';
import { Booking } from './core/models';
import { SessionService } from './core/session';
import { addDays, nextWorkingDay, startOfWeek } from './core/time';
import { BookingPage } from './features/book/booking-page';
import { MyBookingsPage } from './features/bookings/my-bookings-page';
import { resetDb } from './mocks/db';
import { setApiLatency } from './mocks/handlers';
import { MockApiBackend } from './mocks/test-backend';
import { callApi } from './mocks/test-client';

const DAY = addDays(startOfWeek(nextWorkingDay()), 3);

/** Everything the real app provides, minus the network. */
function providers(): (Provider | EnvironmentProviders)[] {
  return [
    provideZonelessChangeDetection(),
    // Material animates with CSS; the tests just skip the transitions.
    { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
    provideNativeDateAdapter(),
    provideRouter([]),
    provideHttpClient(withInterceptors([identityInterceptor])),
    { provide: HttpBackend, useClass: MockApiBackend },
  ];
}

/**
 * What the server holds for a day. The database is seeded with colleagues'
 * meetings, so every assertion looks for its own booking rather than expecting
 * an empty schedule.
 */
async function bookingsOn(day: string): Promise<Booking[]> {
  const response = await callApi('GET', `/api/bookings?from=${day}&to=${day}`, {
    headers: { 'x-user-id': 'u-1', 'x-user-name': 'Alex Rivera', 'x-user-role': 'admin' },
  });
  return (await response.json()) as Booking[];
}

async function bookingFor(day: string, purpose: string): Promise<Booking | undefined> {
  return (await bookingsOn(day)).find((booking) => booking.purpose === purpose);
}

beforeEach(() => {
  localStorage.clear();
  resetDb();
  setApiLatency(0);
});

describe('booking a room', () => {
  it('books the slot that was clicked in the schedule', async () => {
    const user = userEvent.setup();
    const view: RenderResult<BookingPage> = await render(BookingPage, {
      providers: providers(),
      inputs: { roomId: 'r-2', date: DAY, start: String(13 * 60) },
    });
    const router = view.fixture.debugElement.injector.get(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /room/i })).toBeInTheDocument());
    await user.type(screen.getByRole('textbox', { name: /what is it for/i }), 'Quarterly numbers');
    await user.click(screen.getByRole('button', { name: /book the room/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(['/bookings']));

    expect(await bookingFor(DAY, 'Quarterly numbers')).toMatchObject({
      roomId: 'r-2',
      start: 13 * 60,
      end: 14 * 60,
      purpose: 'Quarterly numbers',
      ownerId: 'u-1',
    });
  });

  it('refuses a slot someone else already has, and names them', async () => {
    await callApi('POST', '/api/bookings', {
      headers: { 'x-user-id': 'u-9', 'x-user-name': 'Priya Raman', 'x-user-role': 'employee' },
      body: {
        roomId: 'r-2',
        date: DAY,
        start: 13 * 60,
        end: 14 * 60,
        attendees: 4,
        purpose: 'Sprint planning',
      },
    });

    const user = userEvent.setup();
    await render(BookingPage, {
      providers: providers(),
      inputs: { roomId: 'r-2', date: DAY, start: String(13 * 60) },
    });

    await waitFor(() =>
      expect(screen.getByText(/Priya Raman has .Sprint planning./i)).toBeInTheDocument(),
    );

    await user.type(screen.getByRole('textbox', { name: /what is it for/i }), 'Design review');
    await user.click(screen.getByRole('button', { name: /book the room/i }));

    // The clash blocks the write: theirs stays, mine was never created.
    expect(await bookingFor(DAY, 'Design review')).toBeUndefined();
    expect(await bookingFor(DAY, 'Sprint planning')).toMatchObject({ ownerName: 'Priya Raman' });
  });
});

describe('my bookings', () => {
  async function myBooking(): Promise<void> {
    await callApi('POST', '/api/bookings', {
      headers: { 'x-user-id': 'u-1', 'x-user-name': 'Alex Rivera', 'x-user-role': 'employee' },
      body: {
        roomId: 'r-3',
        date: DAY,
        start: 15 * 60,
        end: 16 * 60,
        attendees: 5,
        purpose: 'Portfolio walkthrough',
      },
    });
  }

  it('lists what I booked and cancels it after confirmation', async () => {
    await myBooking();
    const user = userEvent.setup();

    await render(MyBookingsPage, { providers: providers() });

    await waitFor(() => expect(screen.getByText('Portfolio walkthrough')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    // The dialog is the confirmation step; nothing is cancelled until it is used.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Cedar');
    await user.click(screen.getByRole('button', { name: /cancel booking/i }));

    await waitFor(() => expect(screen.getByText('No bookings yet')).toBeInTheDocument());
    expect(await bookingFor(DAY, 'Portfolio walkthrough')).toBeUndefined();
  });

  it("does not offer to cancel someone else's booking", async () => {
    await callApi('POST', '/api/bookings', {
      headers: { 'x-user-id': 'u-9', 'x-user-name': 'Priya Raman', 'x-user-role': 'employee' },
      body: {
        roomId: 'r-3',
        date: DAY,
        start: 15 * 60,
        end: 16 * 60,
        attendees: 5,
        purpose: 'Not mine',
      },
    });

    await render(MyBookingsPage, { providers: providers() });

    await waitFor(() => expect(screen.getByText('No bookings yet')).toBeInTheDocument());
    expect(screen.queryByText('Not mine')).toBeNull();
  });
});

describe('roles', () => {
  it('switches what the session reports', async () => {
    const view = await render(MyBookingsPage, { providers: providers() });
    const session = view.fixture.debugElement.injector.get(SessionService);

    expect(session.isAdmin()).toBe(false);
    session.setRole('admin');
    expect(session.isAdmin()).toBe(true);
    expect(session.user().role).toBe('admin');
  });
});
