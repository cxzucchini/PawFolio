export const dashboardRoutes = {
  dashboard: '/dashboard',
  profile: '/dashboard/dog-profile',
  dogs: '/dashboard/my-dogs',
  vaccinations: '/dashboard/vaccinations',
  schedules: '/dashboard/schedules',
  medical: '/dashboard/medical-history',
  emergency: '/dashboard/emergency-vault',
  contact: '/dashboard/contact',
};
export function dashboardView(path) {
  const normalized = path.replace(/\/+$/, '') || '/';
  return Object.keys(dashboardRoutes).find(
    (view) => dashboardRoutes[view] === normalized,
  );
}
