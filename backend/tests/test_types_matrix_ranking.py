import pytest
from app.models.enums import QuestionType
from app.question_types import get_spec
from app.question_types.base import AnswerError
from app.schemas.properties import RankingProperties, MatrixProperties, ChoiceOption

def test_ranking_rejects_missing_options():
    spec = get_spec(QuestionType.RANKING)
    props = RankingProperties(options=[ChoiceOption(id="A", label="A"), ChoiceOption(id="B", label="B")])
    
    # Complete and correct
    assert spec.validate(["A", "B"], props) == ["A", "B"]
    
    # Missing option
    with pytest.raises(AnswerError, match="Please rank all options"):
        spec.validate(["A"], props)
        
    # Duplicate option
    with pytest.raises(AnswerError, match="Invalid options"):
        spec.validate(["A", "A"], props)
        
    # Unknown option
    with pytest.raises(AnswerError, match="Invalid options"):
        spec.validate(["A", "C"], props)

def test_ranking_summary_computes_average():
    spec = get_spec(QuestionType.RANKING)
    props = RankingProperties(options=[ChoiceOption(id="A", label="A"), ChoiceOption(id="B", label="B"), ChoiceOption(id="C", label="C")])
    
    class MockQuestion:
        id = 1
        type = QuestionType.RANKING
        title = "Test"
        properties = props

    answers = [
        ["A", "B", "C"], # A=1, B=2, C=3
        ["A", "C", "B"]  # A=1, C=2, B=3
    ]
    summary = spec.summarize(MockQuestion(), answers, [])
    assert summary.answered == 2
    
    # A's average rank is (1+1)/2 = 1.0
    # B's average rank is (2+3)/2 = 2.5
    # C's average rank is (3+2)/2 = 2.5
    assert summary.ranks["A"].average == 1.0
    assert summary.ranks["B"].average == 2.5
    assert summary.ranks["C"].average == 2.5

def test_matrix_single_vs_multiple():
    spec = get_spec(QuestionType.MATRIX)
    
    single_props = MatrixProperties(
        rows=[ChoiceOption(id="R1", label="R1")],
        columns=[ChoiceOption(id="C1", label="C1"), ChoiceOption(id="C2", label="C2")],
        multiple_selection=False
    )
    
    assert spec.validate({"R1": "C1"}, single_props) == {"R1": "C1"}
    with pytest.raises(AnswerError, match="Please choose one option per row"):
        spec.validate({"R1": ["C1", "C2"]}, single_props)
        
    multi_props = MatrixProperties(
        rows=[ChoiceOption(id="R1", label="R1")],
        columns=[ChoiceOption(id="C1", label="C1"), ChoiceOption(id="C2", label="C2")],
        multiple_selection=True
    )
    
    assert spec.validate({"R1": ["C1", "C2"]}, multi_props) == {"R1": ["C1", "C2"]}
    assert spec.validate({"R1": ["C1"]}, multi_props) == {"R1": ["C1"]}
    assert spec.validate({"R1": "C1"}, multi_props) == {"R1": ["C1"]} # Normalized to list

def test_matrix_removed_column_shows_placeholder_in_csv():
    spec = get_spec(QuestionType.MATRIX)
    props = MatrixProperties(
        rows=[ChoiceOption(id="R1", label="Row 1")],
        columns=[ChoiceOption(id="C1", label="Col 1")],
        multiple_selection=False
    )
    
    # Format of matrix returns a string representation for CSV
    # If a column was removed, it should show its ID or a placeholder.
    ans = {"R1": "C2"} # C2 was removed
    formatted = spec.format(ans, props)
    assert "(removed choice)" in formatted
