import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Friend, Game } from './types';

export const useGames = () =>
  useQuery({
    queryKey: ['games'],
    queryFn: () => api.get<Game[]>('/games'),
    staleTime: 5 * 60_000,
  });

export const useFriends = () =>
  useQuery({
    queryKey: ['friends', 'list'],
    queryFn: () => api.get<Friend[]>('/friends'),
  });
