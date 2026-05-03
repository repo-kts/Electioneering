/**
 * Aggregated voter demographics — derived from voter records and Form 20.
 * In production these would come from a backend query like:
 *   SELECT last_name, COUNT(*) FROM voters GROUP BY last_name ORDER BY 2 DESC
 */

export const TOTAL_VOTERS = 622;

export const surnameData = [
  { name: 'Yadav', count: 362 },
  { name: 'Bind', count: 139 },
  { name: 'Devi', count: 53 },
  { name: 'Prasad', count: 32 },
  { name: 'Singh', count: 11 },
  { name: 'Thakur', count: 7 },
  { name: 'Kumari', count: 5 },
  { name: 'Kumar', count: 4 },
  { name: 'Paswan', count: 4 },
  { name: 'Jamadar', count: 3 },
  { name: 'Roshan', count: 1 },
  { name: 'Chauhan', count: 1 },
];

export const genderData = [
  { name: 'Male', count: 325, color: '#2563EB' },
  { name: 'Female', count: 297, color: '#EC4899' },
  { name: 'Third Gender', count: 0, color: '#8B5CF6' },
];

export const ageGroupData = [
  { name: '18–25', count: 18 },
  { name: '26–40', count: 181 },
  { name: '41–60', count: 254 },
  { name: '60+', count: 169 },
];
