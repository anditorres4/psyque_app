import { useMutation } from "@tanstack/react-query";
import { api, type VideoRoomResponse } from "@/lib/api";

export function useCreateVideoRoom(appointmentId: string) {
  return useMutation<VideoRoomResponse, Error>({
    mutationFn: () => api.video.createRoom(appointmentId),
  });
}

export function useRefreshVideoToken(appointmentId: string) {
  return useMutation<VideoRoomResponse, Error>({
    mutationFn: () => api.video.refreshToken(appointmentId),
  });
}