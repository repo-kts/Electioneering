export const partyTotals = [
  { code: 'PNF', name: "People's National Front", votes: 1102000 },
  { code: 'CDA', name: "Citizens' Democratic Alliance", votes: 1034000 },
  { code: 'GUP', name: 'Green Unity Party', votes: 490000 },
  { code: 'IND', name: 'Independents', votes: 221000 },
  { code: 'REG', name: 'Regional Bloc', votes: 168000 },
  { code: 'VRT', name: 'Vox Republic', votes: 92000 },
  { code: 'OTH', name: 'Others', votes: 38000 },
];

export const voteShare = [
  { code: 'PNF', label: 'PNF', sub: 'National Front', value: 38.7, votes: '1.10M' },
  { code: 'CDA', label: 'CDA', sub: 'Democratic', value: 36.3, votes: '1.03M' },
  { code: 'GUP', label: 'GUP', sub: 'Green Unity', value: 17.2, votes: '490K' },
  { code: 'IND', label: 'IND', sub: 'Independents', value: 7.8, votes: '221K' },
];

export const turnout = [
  { hour: '07', today: 3.1, prev: 2.7, forecast: null },
  { hour: '08', today: 9.4, prev: 8.1, forecast: null },
  { hour: '09', today: 17.2, prev: 14.9, forecast: null },
  { hour: '10', today: 26.5, prev: 23.2, forecast: null },
  { hour: '11', today: 34.8, prev: 30.5, forecast: null },
  { hour: '12', today: 41.2, prev: 36.8, forecast: null },
  { hour: '13', today: 47.9, prev: 43.1, forecast: null },
  { hour: '14', today: 54.7, prev: 49.4, forecast: null },
  { hour: '15', today: 63.4, prev: 55.2, forecast: 63.4 },
  { hour: '16', today: null, prev: 60.1, forecast: 65.6 },
  { hour: '17', today: null, prev: 64.8, forecast: 67.0 },
  { hour: '18', today: null, prev: 68.2, forecast: 67.8 },
];

export const topResults = [
  { rank: 1, name: 'Bandra North', candidate: 'A. Mehrotra', stations: 412, party: 'PNF', votes: 48219, share: 52.8, margin: '+ 18.2pt safe', tight: false },
  { rank: 2, name: 'Powai Lake', candidate: 'S. Reddy', stations: 521, party: 'CDA', votes: 61402, share: 47.6, margin: '+ 12.4pt safe', tight: false },
  { rank: 3, name: 'Versova', candidate: 'M. Iqbal', stations: 308, party: 'GUP', votes: 29847, share: 41.2, margin: '+ 1.8pt tight', tight: true },
  { rank: 4, name: 'Andheri West', candidate: 'P. Kulkarni', stations: 196, party: 'PNF', votes: 37581, share: 44.9, margin: '+ 7.3pt', tight: false },
  { rank: 5, name: 'Goregaon East', candidate: 'D. Patil', stations: 308, party: 'CDA', votes: 42118, share: 39.4, margin: '+ 0.9pt recount', tight: true },
  { rank: 6, name: 'Vile Parle', candidate: 'N. Joshi', stations: 287, party: 'IND', votes: 19842, share: 36.7, margin: '+ 4.2pt', tight: false },
  { rank: 7, name: 'Jogeshwari', candidate: 'L. Banerjee', stations: 196, party: 'PNF', votes: 28914, share: 42.3, margin: '+ 9.1pt', tight: false },
  { rank: 8, name: 'Khar Danda', candidate: 'V. Sharma', stations: 142, party: 'CDA', votes: 21407, share: 38.8, margin: '+ 1.4pt tight', tight: true },
];

export const seatsBreakdown = [
  { code: 'PNF', name: 'PNF', seats: 37 },
  { code: 'CDA', name: 'CDA', seats: 34 },
  { code: 'GUP', name: 'GUP', seats: 17 },
  { code: 'IND', name: 'IND', seats: 8 },
];
