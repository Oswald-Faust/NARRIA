"""
Tests de bout en bout du système NARR'IA.

Exécuter : python -m pytest tests/ -v
Ou simplement : python tests/test_core.py
"""

import sys
from pathlib import Path

# Add parent directory to Python path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from narria.m1_segmentation.segmenter import NarrativeSegmenter
from narria.m2_extraction.extractor import GraphExtractor
from narria.m3_comparison.comparator import NarrativeComparator
from narria.m4_database.storage import GraphStore
from narria.m5_reporting.reporter import ReportGenerator
from narria.repertoire.functions import FUNCTION_REPERTOIRE


SAMPLE_TEXT = """
À Vérone, deux familles rivales se haïssent depuis des générations : les Montaigu et les Capulet.
Un soir, Roméo rencontre Juliette au bal et il en tombe amoureux.
Juliette aime Roméo en retour. Ils décident de se marier en secret.
Le lendemain, Tybalt provoque Roméo en duel. Mercutio relève le défi.
Tybalt tue Mercutio. Roméo attaque Tybalt et le tue. Il est banni.
Roméo fuit. Les parents de Juliette veulent la marier à Pâris.
Juliette boit une potion pour faire croire à sa mort.
Roméo ne reçoit pas le message. Il se tue sur le corps de Juliette.
Juliette se réveille, voit Roméo mort, et se tue à son tour.
Les deux familles se réconcilient devant leurs enfants morts.
"""


def test_segmenter():
    segmenter = NarrativeSegmenter()
    segments = segmenter.segment(SAMPLE_TEXT)
    assert len(segments) > 0, "Le segmenteur doit produire au moins un segment"
    print(f"✓ Segmenter : {len(segments)} segments produits")
    for s in segments[:3]:
        print(f"   - [{s.segment_id}] {s.word_count} mots, entités: {s.entities[:3]}")


def test_extractor():
    segmenter = NarrativeSegmenter()
    extractor = GraphExtractor()
    segments = segmenter.segment(SAMPLE_TEXT)
    graph = extractor.extract(segments, metadata={'title': 'Test', 'author': 'Test'})
    
    assert len(graph.nodes) > 0, "Le graphe doit contenir des nœuds"
    assert len(graph.edges) > 0, "Le graphe doit contenir des arêtes"
    print(f"✓ Extractor : {len(graph.nodes)} nœuds, {len(graph.edges)} arêtes")
    
    # Verify some nodes have functions
    functions = [n.function_code for n in graph.nodes if n.function_code]
    print(f"   Fonctions identifiées : {functions[:10]}")


def test_comparator():
    segmenter = NarrativeSegmenter()
    extractor = GraphExtractor()
    comparator = NarrativeComparator()
    
    # Compare text with itself
    segments = segmenter.segment(SAMPLE_TEXT)
    graph = extractor.extract(segments, metadata={'title': 'Test', 'author': 'Test'})
    
    result = comparator.compare(graph, graph)
    assert result.sns > 0.7, f"Comparaison d'un texte avec lui-même doit donner un SNS élevé (obtenu: {result.sns})"
    print(f"✓ Comparator (texte avec lui-même) : SNS={result.sns:.3f}, modalité='{result.detected_modality}'")


def test_storage():
    import tempfile, os
    with tempfile.TemporaryDirectory() as tmpdir:
        store = GraphStore(base_dir=tmpdir)
        segmenter = NarrativeSegmenter()
        extractor = GraphExtractor()
        segments = segmenter.segment(SAMPLE_TEXT)
        graph = extractor.extract(segments, metadata={'title': 'Test', 'author': 'Test'})
        
        path = store.save(graph)
        assert os.path.exists(path), "Le fichier doit exister après save()"
        
        loaded = store.load(graph.graph_id)
        assert loaded is not None, "Le graphe doit pouvoir être rechargé"
        assert len(loaded.nodes) == len(graph.nodes), "Nombre de nœuds identique après reload"
        print(f"✓ Storage : save + load OK ({len(loaded.nodes)} nœuds préservés)")


def test_reporter():
    segmenter = NarrativeSegmenter()
    extractor = GraphExtractor()
    comparator = NarrativeComparator()
    reporter = ReportGenerator()
    
    segments = segmenter.segment(SAMPLE_TEXT)
    graph = extractor.extract(segments, metadata={'title': 'Test', 'author': 'Test'})
    result = comparator.compare(graph, graph)
    
    html = reporter.generate_html(result, graph, graph)
    assert '<html' in html.lower(), "Le rapport doit contenir du HTML"
    assert 'SNS' in html, "Le rapport doit mentionner le SNS"
    assert 'NARR' in html, "Le rapport doit mentionner NARR'IA"
    print(f"✓ Reporter : rapport HTML généré ({len(html)} caractères)")


def test_repertoire():
    total = sum(len(f['functions']) for f in FUNCTION_REPERTOIRE['families'])
    african = sum(1 for fam in FUNCTION_REPERTOIRE['families']
                  for f in fam['functions'] if f.get('african'))
    assert total == 53, f"Le répertoire doit contenir 53 fonctions (obtenu: {total})"
    assert african == 7, f"Le répertoire doit contenir 7 fonctions africaines (obtenu: {african})"
    print(f"✓ Répertoire : {total} fonctions en {len(FUNCTION_REPERTOIRE['families'])} familles dont {african} africaines")


def test_end_to_end():
    """Test complet : text → segments → graphe → comparaison → rapport."""
    segmenter = NarrativeSegmenter()
    extractor = GraphExtractor()
    comparator = NarrativeComparator()
    reporter = ReportGenerator()
    
    # Load two sample files
    import json
    samples_dir = ROOT / 'narria' / 'samples'
    romeo = json.loads((samples_dir / 'romeo_juliette.json').read_text())
    conakry = json.loads((samples_dir / 'amants_conakry.json').read_text())
    
    # Analyze both
    romeo_segs = segmenter.segment(romeo['text'])
    romeo_graph = extractor.extract(romeo_segs, metadata={'title': romeo['title'], 'author': romeo['author']})
    
    conakry_segs = segmenter.segment(conakry['text'])
    conakry_graph = extractor.extract(conakry_segs, metadata={'title': conakry['title'], 'author': conakry['author']})
    
    # Compare: they should be structurally very similar
    result = comparator.compare(romeo_graph, conakry_graph)
    print(f"✓ End-to-end Roméo vs Conakry : SNS={result.sns:.3f}")
    print(f"   Modalité détectée : {result.detected_modality}")
    print(f"   SRJ : {result.srj:.3f} ({result.srj_level})")
    
    # Compare Conakry with saison_pluies (should be different structures)
    pluies = json.loads((samples_dir / 'saison_pluies.json').read_text())
    pluies_segs = segmenter.segment(pluies['text'])
    pluies_graph = extractor.extract(pluies_segs, metadata={'title': pluies['title'], 'author': pluies['author']})
    
    result2 = comparator.compare(romeo_graph, pluies_graph)
    print(f"✓ End-to-end Roméo vs Saison des pluies : SNS={result2.sns:.3f}")
    print(f"   Modalité détectée : {result2.detected_modality}")
    
    # The first comparison should score higher than the second
    assert result.sns > result2.sns, (
        f"Conakry (transposition) doit être plus similaire à Roméo que Saison des pluies. "
        f"Obtenu: {result.sns:.3f} vs {result2.sns:.3f}"
    )
    print(f"✓ Discrimination OK : transposition {result.sns:.3f} > récit étranger {result2.sns:.3f}")


if __name__ == '__main__':
    print("═══ TESTS NARR'IA ═══\n")
    test_repertoire()
    test_segmenter()
    test_extractor()
    test_comparator()
    test_storage()
    test_reporter()
    test_end_to_end()
    print("\n═══ TOUS LES TESTS RÉUSSIS ═══")
