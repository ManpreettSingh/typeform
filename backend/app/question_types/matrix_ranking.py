from typing import Any

from app.models.enums import QuestionType
from app.question_types.base import AnswerError, QuestionTypeSpec
from app.schemas.properties import MatrixProperties, RankingProperties
from app.schemas.response import MatrixSummary, RankingSummary, OptionCount, ChoiceSummary, RankAverage

def _validate_ranking(value: Any, properties: RankingProperties | dict) -> Any:
    if isinstance(properties, dict):
        properties = RankingProperties(**properties)
    if not isinstance(value, list):
        raise AnswerError("Answer must be a list of option IDs")
    
    val_list = value
    opts = {o.id for o in properties.options}
    
    if len(val_list) != len(opts) or set(val_list) != opts:
        if set(val_list) - opts or len(val_list) != len(set(val_list)):
            raise AnswerError("Invalid options")
        raise AnswerError("Please rank all options")
        
    return val_list

def _format_ranking(value: Any, properties: RankingProperties | dict) -> str:
    if isinstance(properties, dict):
        properties = RankingProperties(**properties)
    if not isinstance(value, list):
        return ""
    
    lbls = []
    for opt_id in value:
        opt = next((o for o in properties.options if o.id == opt_id), None)
        lbl = opt.label if opt else "(removed choice)"
        lbls.append(lbl)
    
    return ", ".join(lbls)

def _summarize_ranking(question, answers: list[Any], dates) -> RankingSummary:
    opts = {o.id: o.label for o in question.properties.options}
    # Initialize counts and totals for average
    totals = {opt_id: 0 for opt_id in opts}
    counts = {opt_id: 0 for opt_id in opts}
    
    answered = 0
    for ans in answers:
        if isinstance(ans, list):
            answered += 1
            for rank, opt_id in enumerate(ans):
                if opt_id in totals:
                    totals[opt_id] += (rank + 1)
                    counts[opt_id] += 1
                    
    ranks = {}
    for opt_id, total in totals.items():
        if counts[opt_id] > 0:
            avg = total / counts[opt_id]
            ranks[opt_id] = RankAverage(option_id=opt_id, label=opts[opt_id], average=avg)
            
    # Include removed choices if they appeared in answers
    for ans in answers:
        if isinstance(ans, list):
            for rank, opt_id in enumerate(ans):
                if opt_id not in opts:
                    if opt_id not in ranks:
                        ranks[opt_id] = RankAverage(option_id=opt_id, label="(removed choice)", average=0)
                        totals[opt_id] = 0
                        counts[opt_id] = 0
                    totals[opt_id] += (rank + 1)
                    counts[opt_id] += 1
                    ranks[opt_id].average = totals[opt_id] / counts[opt_id]

    return RankingSummary(
        question_id=question.id,
        title=question.title,
        type=question.type,
        answered=answered,
        ranks=ranks
    )

def _validate_matrix(value: Any, properties: MatrixProperties | dict) -> Any:
    if isinstance(properties, dict):
        properties = MatrixProperties(**properties)
    if not isinstance(value, dict):
        raise AnswerError("Answer must be a dictionary")
        
    rows = {r.id for r in properties.rows}
    cols = {c.id for c in properties.columns}
    
    out = {}
    for row_id, col_val in value.items():
        if row_id not in rows:
            raise AnswerError(f"Invalid row: {row_id}")
            
        if properties.multiple_selection:
            if not isinstance(col_val, list):
                col_val = [col_val]
            
            clean = []
            for c in col_val:
                if c not in cols:
                    raise AnswerError(f"Invalid column: {c}")
                clean.append(c)
                
            out[row_id] = clean
        else:
            if isinstance(col_val, list):
                if len(col_val) > 1:
                    raise AnswerError("Please choose one option per row")
                elif len(col_val) == 1:
                    col_val = col_val[0]
                else:
                    raise AnswerError("Please choose one option per row")
            if col_val not in cols:
                raise AnswerError(f"Invalid column: {col_val}")
            out[row_id] = col_val
            
    return out

def _format_matrix(value: Any, properties: MatrixProperties | dict) -> str:
    if isinstance(properties, dict):
        properties = MatrixProperties(**properties)
    if not isinstance(value, dict):
        return ""
        
    rows = {r.id: r.label for r in properties.rows}
    cols = {c.id: c.label for c in properties.columns}
    
    parts = []
    for row_id, col_val in value.items():
        row_lbl = rows.get(row_id, "(removed row)")
        
        if isinstance(col_val, list):
            col_lbls = [cols.get(c, "(removed choice)") for c in col_val]
            col_lbl = ", ".join(col_lbls)
        else:
            col_lbl = cols.get(col_val, "(removed choice)")
            
        parts.append(f"{row_lbl}: {col_lbl}")
        
    return " | ".join(parts)

def _summarize_matrix(question, answers: list[Any], dates) -> MatrixSummary:
    rows = {r.id: r.label for r in question.properties.rows}
    cols = {c.id: c.label for c in question.properties.columns}
    
    answered = 0
    row_summaries = {}
    for r in question.properties.rows:
        row_summaries[r.id] = ChoiceSummary(
            question_id=question.id,
            title=r.label,
            answered=0,
            type=QuestionType.MULTIPLE_CHOICE if question.properties.multiple_selection else QuestionType.DROPDOWN,
            counts=[OptionCount(option_id=c.id, label=c.label, count=0) for c in question.properties.columns]
        )
        
    for ans in answers:
        if isinstance(ans, dict) and ans:
            answered += 1
            for row_id, col_val in ans.items():
                if row_id in row_summaries:
                    row_summaries[row_id].answered += 1
                    
                    if isinstance(col_val, list):
                        c_vals = col_val
                    else:
                        c_vals = [col_val]
                        
                    for c in c_vals:
                        count_obj = next((x for x in row_summaries[row_id].counts if x.option_id == c), None)
                        if count_obj:
                            count_obj.count += 1
                        else:
                            # Stale column
                            row_summaries[row_id].counts.append(OptionCount(option_id=c, label="(removed choice)", count=1))
                            
    return MatrixSummary(
        question_id=question.id,
        title=question.title,
        type=question.type,
        answered=answered,
        rows=row_summaries
    )


SPECS = [
    QuestionTypeSpec(
        key=QuestionType.RANKING,
        properties_model=RankingProperties,
        validate=_validate_ranking,
        format=_format_ranking,
        summarize=_summarize_ranking,
        logic_ops=frozenset(["is", "is_not"]),
        answerable=True,
        defaults=lambda: {"options": [{"id": "1", "label": "Option 1"}, {"id": "2", "label": "Option 2"}], "randomize": False},
        sample=lambda p, r: [o["id"] for o in p["options"]]
    ),
    QuestionTypeSpec(
        key=QuestionType.MATRIX,
        properties_model=MatrixProperties,
        validate=_validate_matrix,
        format=_format_matrix,
        summarize=_summarize_matrix,
        logic_ops=frozenset(),
        answerable=True,
        defaults=lambda: {"rows": [{"id": "r1", "label": "Row 1"}], "columns": [{"id": "c1", "label": "Column 1"}], "multiple_selection": False},
        sample=lambda p, r: {row["id"]: r.choice([c["id"] for c in p["columns"]]) for row in p["rows"]}
    ),
]
