import type { AlertRecord } from '../components/FireAlertModal';

export interface DateGroup<T> {
  dateKey: string;
  label: string;
  subLabel?: string;
  items: T[];
}

/**
 * Normalise et formate un record d'alerte avec rawDate, date lisible et heure formatée.
 */
export function formatAlertItem(alert: any, apiUrl: string): AlertRecord {
  const rawDate = alert.date || '';
  const dateObj = new Date(rawDate);
  const isValid = !isNaN(dateObj.getTime());

  const formattedDate = isValid
    ? dateObj.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : rawDate;

  const formattedTime = isValid
    ? dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  let fullImageUrl = alert.image_url;
  if (fullImageUrl && !fullImageUrl.startsWith('http') && !fullImageUrl.startsWith('data:')) {
    fullImageUrl = `${apiUrl}${fullImageUrl.startsWith('/') ? '' : '/'}${fullImageUrl}`;
  }

  return {
    id: alert.id,
    status: alert.status,
    location: (alert.location || '').replace(/\(Feu\)/g, '(Fumée)'),
    date: formattedDate,
    rawDate: rawDate,
    formattedTime: formattedTime,
    confidence: alert.confidence,
    coords: alert.coords || '46.2276°N 2.2137°E',
    image_url: fullImageUrl,
    detection_type: alert.detection_type || (alert.status === 'fire' ? 'smoke' : 'person'),
  };
}

/**
 * Regroupe une liste d'alertes par date (Aujourd'hui, Hier, ou Date formatée),
 * triée par ordre antéchronologique (plus récent en premier).
 */
export function groupAlertsByDate<T extends AlertRecord>(alerts: T[]): DateGroup<T>[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  const groupsMap = new Map<
    string,
    { label: string; subLabel?: string; timestamp: number; items: T[] }
  >();

  for (const item of alerts) {
    const raw = item.rawDate || item.date;
    const d = new Date(raw);
    const isValid = !isNaN(d.getTime());

    const dateKey = isValid
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : 'unknown';

    let label = '';
    let subLabel: string | undefined = undefined;

    if (!isValid) {
      label = 'Dates antérieures';
    } else if (dateKey === todayKey) {
      label = "Aujourd'hui";
      subLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } else if (dateKey === yesterdayKey) {
      label = 'Hier';
      subLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } else {
      const full = d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      label = full.charAt(0).toUpperCase() + full.slice(1);
    }

    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, {
        label,
        subLabel,
        timestamp: isValid ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : 0,
        items: [],
      });
    }

    groupsMap.get(dateKey)!.items.push(item);
  }

  // Trier les groupes du plus récent au plus ancien
  const sortedGroups = Array.from(groupsMap.entries())
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .map(([dateKey, val]) => {
      // Trier les éléments à l'intérieur du groupe par heure décroissante
      const sortedItems = [...val.items].sort((a, b) => {
        const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
        const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
        return timeB - timeA;
      });

      return {
        dateKey,
        label: val.label,
        subLabel: val.subLabel,
        items: sortedItems,
      };
    });

  return sortedGroups;
}
