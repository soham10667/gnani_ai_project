import csv
import io
from typing import Dict, Any
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from backend.database import db
from backend.routers.auth import get_current_user
from backend.services.correction_learner import correction_learner
from backend.services.gnani_stt import gnani_stt
from backend.services.tts_service import tts_service
from backend.services.llm_service import llm_service

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Reporting"])


@router.get("/dashboard")
def get_dashboard_analytics(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns real-time dashboard metrics calculated directly from database rows
    plus live service statuses (API, STT, TTS, LLM, Database).
    """
    stats = db.get_dashboard_stats()
    return {
        **stats,
        "services": {
            "database": db.check_health(),
            "stt": gnani_stt.get_status(),
            "tts": tts_service.get_status(),
            "llm": llm_service.get_status(),
        },
    }


@router.get("/summary")
def get_analytics_summary(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns real-data Analytics dashboard metrics, charts, and ML correction status."""
    stats = db.get_dashboard_stats()
    charts = db.get_real_chart_metrics()
    model_status = correction_learner.fit_from_logs()
    return {
        "dashboard_stats": stats,
        "corrections_by_entity_chart": charts["corrections_by_entity_chart"],
        "confidence_distribution_chart": charts["confidence_distribution_chart"],
        "ml_learning_status": model_status,
        "services": {
            "database": db.check_health(),
            "stt": gnani_stt.get_status(),
            "tts": tts_service.get_status(),
            "llm": llm_service.get_status(),
        },
    }


@router.get("/correction-logs")
def get_correction_logs(
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    logs = db.get_correction_logs(limit=limit)
    model_status = correction_learner.fit_from_logs()
    return {
        "logs": logs,
        "count": len(logs),
        "model_status": model_status,
    }


@router.get("/export-csv")
def export_compliance_csv(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Generates and streams an authentic RBI BFSI compliance CSV directly from database records."""
    sessions = db.get_sessions(limit=250)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Session ID",
        "Customer Name",
        "Customer Code",
        "Application No",
        "Channel",
        "Status",
        "Initial Conf (%)",
        "Final Conf (%)",
        "Corrections Count",
        "Verification Summary",
        "Updated At",
    ])
    for s in sessions:
        writer.writerow([
            s.get("id", ""),
            s.get("customer_name", ""),
            s.get("customer_code", s.get("customer_id", "")),
            s.get("app_no", ""),
            s.get("channel", ""),
            s.get("status", ""),
            s.get("initial_conf", 0.0),
            s.get("final_conf", 0.0),
            s.get("corrections", 0),
            s.get("verification_summary", ""),
            s.get("updated_at", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=echotrust_compliance_audit.csv"},
    )
