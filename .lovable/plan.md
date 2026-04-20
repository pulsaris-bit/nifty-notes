
## Plan: Share-knop kleur wijzigen bij gedeelde notities

### Doel
Wanneer een notitie daadwerkelijk gedeeld is met andere gebruikers (dus er zijn actieve shares), moet het share-logo een andere kleur krijgen zodat dit visueel duidelijk is.

### Huidige situatie
- De share-knop is altijd grijs (`text-muted-foreground`)
- Er is geen visuele indicatie of een notitie al gedeeld is

### Gewenste situatie
- Wanneer een notitie gedeeld is (`shares.length > 0`), krijgt de share-knop een accentkleur (bijv. `text-primary` of `text-orange-500`)
- Dit geeft direct visueel feedback dat de notitie gedeeld is

### Implementatie

**Bestand: `src/components/NoteEditor.tsx`**

1. **State toevoegen voor shares**:
   - Voeg een `shares` state toe om de shares van de huidige notitie bij te houden
   - Voeg een `useEffect` toe die `listShares` aanroept wanneer de notitie verandert

2. **Share-knop stylen**:
   - Wijzig de share-knop om een andere kleur te hebben wanneer `shares.length > 0`
   - Gebruik bijvoorbeeld `text-primary` of een specifieke kleur zoals `text-orange-500`

3. **Optioneel: share count tonen**:
   - Overweeg om een kleine badge te tonen met het aantal shares (bijv. "3" als er 3 mensen zijn)

### Technische details

```typescript
// Nieuwe state
const [shares, setShares] = useState<NoteShare[]>([]);

// useEffect om shares te laden
useEffect(() => {
  if (!note || !listShares || !isOwner) {
    setShares([]);
    return;
  }
  listShares(note.id).then(setShares).catch(() => setShares([]));
}, [note?.id, listShares, isOwner]);

// Share-knop met conditionele styling
<button
  onClick={() => setShowShareDialog(true)}
  className={`p-1.5 rounded-md hover:bg-muted transition-colors ${
    shares.length > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  }`}
  title={shares.length > 0 ? `Gedeeld met ${shares.length} gebruiker(s)` : 'Delen'}
>
  <Share2 size={16} />
</button>
```

### Randgevallen
- Wanneer de notitie wordt gedeeld terwijl de share dialog open is, moet de kleur direct updaten
- Wanneer shares worden verwijderd, moet de kleur terug naar de default
- De kleur moet ook werken in view-mode en edit-mode
