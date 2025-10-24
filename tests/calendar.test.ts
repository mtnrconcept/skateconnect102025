import test from 'node:test';
import assert from 'node:assert/strict';
import { generateICS, buildGoogleCalendarUrl, getICSFileName } from '../src/lib/calendar.js';
import type { CommunityEvent } from '../src/types/index.js';

const baseEvent: CommunityEvent = {
  id: 'battle-lyon',
  title: 'Battle of Lyon',
  description: 'Session street géante avec modules DIY, best trick et jam par équipes toute la journée.',
  date: 'Samedi 16 mars 2025',
  time: '10h00 - 20h00',
  location: 'Place des Terreaux, Lyon',
  type: 'Compétition',
  attendees: 128,
};

test('generateICS produit un événement avec horaires précis', () => {
  const ics = generateICS(baseEvent);

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:Battle of Lyon/);
  assert.match(ics, /DTSTART:20250316T100000/);
  assert.match(ics, /DTEND:20250316T200000/);
  assert.match(ics, /LOCATION:Place des Terreaux\\, Lyon/);
});

test('generateICS gère les événements en journée complète', () => {
  const submissionEvent: CommunityEvent = {
    id: 'call-for-crews',
    title: 'Appel à projet - Upgrade ton spot',
    description: 'Nos partenaires financent des crews motivées pour rénover leurs spots locaux.',
    date: 'Clôture le 30 avril 2025',
    time: 'Soumission en ligne',
    location: 'Plateforme Shredloc',
    type: 'Appel à projet',
    attendees: 58,
    is_sponsor_event: true,
    sponsor_name: 'Foundation Skate Fund',
  };

  const ics = generateICS(submissionEvent);

  assert.match(ics, /DTSTART;VALUE=DATE:20250430/);
  assert.match(ics, /DTEND;VALUE=DATE:20250501/);
  assert.match(ics, /Horaire: Soumission en ligne/);
});

test('buildGoogleCalendarUrl construit une URL partageable', () => {
  const url = buildGoogleCalendarUrl(baseEvent);
  assert.match(url, /https:\/\/www\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(url, /text=Battle(?:%20|\+)of(?:%20|\+)Lyon/);
  assert.match(url, /dates=20250316T100000%2F20250316T200000/);
  assert.match(url, /ctz=Europe%2FParis/);
});

test('getICSFileName sanitise le nom de fichier', () => {
  const fileName = getICSFileName({
    ...baseEvent,
    id: 'Avant-première "Concrete Dreams"',
  });
  assert.equal(fileName, 'avant-premiere-concrete-dreams.ics');
});
