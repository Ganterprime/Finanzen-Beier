import { useColorScheme } from 'react-native';

const light = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  text: '#1C1F24',
  muted: '#6B7280',
  border: '#E3E6EA',
  primary: '#2F6FED',
  expense: '#D64545',
  income: '#2E9E6B',
  chip: '#EBEEF3',
};

const dark: typeof light = {
  bg: '#111317',
  card: '#1B1E24',
  text: '#ECEEF1',
  muted: '#9AA1AC',
  border: '#2A2E36',
  primary: '#5B8CFF',
  expense: '#F06464',
  income: '#4CC38A',
  chip: '#262A32',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
