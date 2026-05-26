import { request, publicRequest } from "./client";

export interface VideoRoomResponse {
  room_id: string;
  host_token: string;
  guest_token: string;
  patient_join_url: string;
  email_sent: boolean;
}

export interface PublicVideoTokenResponse {
  room_id: string;
  token: string;
}

export const videoApi = {
  createRoom: (appointmentId: string) =>
    request<VideoRoomResponse>("POST", `/appointments/${appointmentId}/video-room`),
  refreshToken: (appointmentId: string) =>
    request<VideoRoomResponse>("GET", `/appointments/${appointmentId}/video-room/token`),
  getPublicJoinToken: (appointmentId: string, joinKey: string) =>
    publicRequest<PublicVideoTokenResponse>(
      "GET",
      `/appointments/public/${appointmentId}/video-room/token?join_key=${encodeURIComponent(joinKey)}`
    ),
};
