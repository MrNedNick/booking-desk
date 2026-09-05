/** Domain model shared by the UI, the typed API client and the mock server. */

export type Role = 'employee' | 'admin';

export interface User {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}

export type RoomFeature = 'display' | 'whiteboard' | 'video';

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly floor: number;
  readonly capacity: number;
  readonly features: readonly RoomFeature[];
}

export interface Booking {
  readonly id: string;
  readonly roomId: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  /** Minutes from midnight, inclusive. */
  readonly start: number;
  /** Minutes from midnight, exclusive. */
  readonly end: number;
  readonly purpose: string;
  readonly attendees: number;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly createdAt: string;
}

export type NewBooking = Omit<Booking, 'id' | 'ownerId' | 'ownerName' | 'createdAt'>;

/** Shape of every error body the mock API returns. */
export interface ApiError {
  readonly message: string;
  readonly conflict?: {
    readonly purpose: string;
    readonly ownerName: string;
    readonly start: number;
    readonly end: number;
  };
}
