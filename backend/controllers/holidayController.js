const fs = require('fs').promises;
const path = require('path');
const Holidays = require('date-holidays');

/** Same JSON files as Next route; override dir with HOLIDAY_DATA_DIR for Docker bind-mount */
function getDataDir() {
  if (process.env.HOLIDAY_DATA_DIR && String(process.env.HOLIDAY_DATA_DIR).trim()) {
    return path.resolve(process.env.HOLIDAY_DATA_DIR);
  }
  return path.join(__dirname, '..', 'data');
}

function getHolidaysPath() {
  return path.join(getDataDir(), 'holidays.json');
}

function getHolidayOverridesPath() {
  return path.join(getDataDir(), 'holiday-overrides.json');
}

const holidayCalculator = new Holidays('TH');
holidayCalculator.setLanguages('th');

function parseOverrides(raw) {
  try {
    const parsed = JSON.parse(raw);
    return { excludedOfficialDates: (parsed.excludedOfficialDates || []).filter(Boolean) };
  } catch {
    const extractedDates = raw.match(/\d{4}-\d{2}-\d{2}/g) || [];
    return { excludedOfficialDates: Array.from(new Set(extractedDates)).sort() };
  }
}

async function ensureDirFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/** GET /api/holidays?year= */
const getHolidays = async (req, res) => {
  try {
    const yearParam = Number.parseInt(req.query.year || '', 10);

    const holidaysPath = getHolidaysPath();
    const holidaysData = await fs.readFile(holidaysPath, 'utf-8').catch(() => '[]');
    const customList = JSON.parse(holidaysData);

    const overridesPath = getHolidayOverridesPath();
    const overridesData = await fs.readFile(overridesPath, 'utf-8').catch(() => '{"excludedOfficialDates":[]}');
    const overrides = parseOverrides(overridesData);
    const excluded = new Set((overrides.excludedOfficialDates || []).filter(Boolean));

    const years = new Set();
    if (Number.isFinite(yearParam)) {
      years.add(yearParam);
    } else {
      const currentYear = new Date().getFullYear();
      years.add(currentYear - 1);
      years.add(currentYear);
      years.add(currentYear + 1);
      customList.forEach((h) => {
        const y = Number.parseInt(String(h.date || '').slice(0, 4), 10);
        if (Number.isFinite(y)) years.add(y);
      });
    }

    const officialList = Array.from(years)
      .flatMap((year) => {
        const holidays = holidayCalculator.getHolidays(year) || [];
        return holidays
          .filter((h) => h.type === 'public' && h.start instanceof Date)
          .map((h, idx) => {
            // Prefer library calendar date string. Do NOT use Date#getDate() —
            // date-holidays stores TH midnight as previous-day 17:00Z, so UTC servers
            // shift holidays back by 1 day (e.g. New Year → Dec 31).
            let date = '';
            if (typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(h.date)) {
              date = h.date.slice(0, 10);
            } else {
              date = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Bangkok',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(h.start);
            }
            const name = h.substitute
              ? `${h.name || 'Holiday'} (substitute)`
              : h.name || 'Holiday';
            return {
              id: `official-${year}-${idx}-${date}`,
              date,
              name,
              source: 'official',
            };
          })
          .filter((h) => !excluded.has(h.date));
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const mergedByDate = new Map();
    officialList.forEach((h) => mergedByDate.set(h.date, h));
    customList
      .map((h) => ({ ...h, source: 'custom' }))
      .forEach((h) => mergedByDate.set(h.date, h));

    const list = Array.from(mergedByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    res.json({ success: true, data: list });
  } catch (e) {
    console.error('getHolidays error', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to load holidays' });
  }
};

/** POST /api/holidays */
const addHoliday = async (req, res) => {
  try {
    const body = req.body || {};
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date (use YYYY-MM-DD)' });
    }
    const filePath = getHolidaysPath();
    await ensureDirFor(filePath);
    const data = await fs.readFile(filePath, 'utf-8').catch(() => '[]');
    const list = JSON.parse(data);
    const id = `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    list.push({ id, date, name: name || 'Holiday', source: 'custom' });
    await fs.writeFile(filePath, JSON.stringify(list, null, 2), 'utf-8');
    res.json({ success: true, data: { id, date, name: name || 'Holiday', source: 'custom' } });
  } catch (e) {
    console.error('addHoliday error', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to add holiday' });
  }
};

/** DELETE /api/holidays/:id */
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing holiday id' });
    }

    if (id.startsWith('official-')) {
      const dateMatch = id.match(/(\d{4}-\d{2}-\d{2})$/);
      const date = dateMatch && dateMatch[1];
      if (!date) {
        return res.status(400).json({ success: false, message: 'Invalid official holiday id' });
      }

      const overridesPath = getHolidayOverridesPath();
      const overridesData = await fs.readFile(overridesPath, 'utf-8').catch(() => '{"excludedOfficialDates":[]}');
      const overrides = parseOverrides(overridesData);
      const excluded = new Set((overrides.excludedOfficialDates || []).filter(Boolean));
      excluded.add(date);
      await ensureDirFor(overridesPath);
      await fs.writeFile(
        overridesPath,
        JSON.stringify({ excludedOfficialDates: Array.from(excluded).sort() }, null, 2),
        'utf-8'
      );
      return res.json({ success: true });
    }

    const filePath = getHolidaysPath();
    const fileData = await fs.readFile(filePath, 'utf-8').catch(() => '[]');
    const list = JSON.parse(fileData);
    const next = list.filter((h) => h.id !== id);
    if (next.length === list.length) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }
    await ensureDirFor(filePath);
    await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    console.error('deleteHoliday error', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to delete holiday' });
  }
};

/** POST /api/holidays/clear-custom */
const clearCustomHolidays = async (_req, res) => {
  try {
    const filePath = getHolidaysPath();
    await ensureDirFor(filePath);
    await fs.writeFile(filePath, '[]', 'utf-8');
    res.json({ success: true });
  } catch (e) {
    console.error('clearCustomHolidays error', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to delete all custom holidays' });
  }
};

/** POST /api/holidays/restore-official */
const restoreOfficialHolidays = async (_req, res) => {
  try {
    const filePath = getHolidayOverridesPath();
    await ensureDirFor(filePath);
    await fs.writeFile(filePath, JSON.stringify({ excludedOfficialDates: [] }, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    console.error('restoreOfficialHolidays error', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to restore official holidays' });
  }
};

module.exports = {
  getHolidays,
  addHoliday,
  deleteHoliday,
  clearCustomHolidays,
  restoreOfficialHolidays,
};
