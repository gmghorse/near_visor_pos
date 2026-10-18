#![allow(clippy::too_many_arguments)]

mod entities;

use sea_orm::{ConnectionTrait, Database, DatabaseConnection, DbBackend, Statement};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf, sync::Arc};
use tauri::Manager;
use tokio::sync::Mutex;
use uuid::Uuid;

type Db = Arc<Mutex<DatabaseConnection>>;

#[derive(Debug, Serialize)]
struct ProductDto {
    id: String,
    name: String,
    sku: Option<String>,
    barcode: Option<String>,
    category_id: Option<String>,
    price: i64,
    cost: i64,
    stock: i64,
    reorder_level: i64,
    is_active: bool,
}
#[derive(Debug, Serialize)]
struct CategoryDto {
    id: String,
    name: String,
}
#[derive(Debug, Serialize)]
struct MovementDto {
    id: String,
    product_id: String,
    product_name: String,
    change: i64,
    reason: String,
    note: Option<String>,
    created_at: String,
}
#[derive(Debug, Serialize)]
struct SaleDto {
    id: String,
    subtotal: i64,
    discount: i64,
    tax: i64,
    total: i64,
    payment_method: String,
    status: String,
    created_at: String,
}
#[derive(Debug, Serialize)]
struct SaleItemDto {
    id: String,
    product_name: String,
    quantity: i64,
    unit_price: i64,
}
#[derive(Debug, Serialize)]
struct TopProduct {
    name: String,
    units: i64,
    revenue: i64,
}
#[derive(Debug, Serialize)]
struct DashboardDto {
    today_revenue: i64,
    today_transactions: i64,
    today_profit: i64,
    low_stock_count: i64,
    top_products: Vec<TopProduct>,
    recent_sales: Vec<SaleDto>,
}
#[derive(Debug, Serialize)]
struct CheckoutResult {
    sale_id: String,
    subtotal: i64,
    tax: i64,
    total: i64,
    created_at: String,
}
#[derive(Debug, Serialize)]
struct DayRow {
    day: String,
    transactions: i64,
    revenue: i64,
}
#[derive(Debug, Serialize)]
struct ProfitRow {
    name: String,
    units: i64,
    revenue: i64,
    profit: i64,
}
#[derive(Debug, Serialize)]
struct ValuationRow {
    name: String,
    stock: i64,
    cost_value: i64,
    retail_value: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductInput {
    name: String,
    sku: Option<String>,
    barcode: Option<String>,
    category_id: Option<String>,
    price: i64,
    cost: i64,
    stock: i64,
    reorder_level: i64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CartItem {
    product_id: String,
    quantity: i64,
}

fn id() -> String {
    Uuid::now_v7().to_string()
}
fn sql(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}
fn db_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

async fn query_product(db: &DatabaseConnection, product_id: &str) -> Result<ProductDto, String> {
    let row = db.query_one_raw(Statement::from_sql_and_values(DbBackend::Sqlite, "SELECT id,name,sku,barcode,category_id,price,cost,stock,reorder_level,is_active FROM products WHERE id = ?", [product_id.into()])).await.map_err(db_error)?.ok_or("Product not found")?;
    Ok(ProductDto {
        id: row.try_get("", "id").map_err(db_error)?,
        name: row.try_get("", "name").map_err(db_error)?,
        sku: row.try_get("", "sku").map_err(db_error)?,
        barcode: row.try_get("", "barcode").map_err(db_error)?,
        category_id: row.try_get("", "category_id").map_err(db_error)?,
        price: row.try_get("", "price").map_err(db_error)?,
        cost: row.try_get("", "cost").map_err(db_error)?,
        stock: row.try_get("", "stock").map_err(db_error)?,
        reorder_level: row.try_get("", "reorder_level").map_err(db_error)?,
        is_active: row.try_get("", "is_active").map_err(db_error)?,
    })
}

#[tauri::command]
async fn list_products(
    db: tauri::State<'_, Db>,
    include_inactive: bool,
) -> Result<Vec<ProductDto>, String> {
    let guard = db.lock().await;
    let filter = if include_inactive {
        ""
    } else {
        " WHERE is_active = 1"
    };
    let rows = guard.query_all_raw(Statement::from_string(DbBackend::Sqlite, format!("SELECT id,name,sku,barcode,category_id,price,cost,stock,reorder_level,is_active FROM products{} ORDER BY name", filter))).await.map_err(db_error)?;
    rows.into_iter()
        .map(|row| {
            Ok(ProductDto {
                id: row.try_get("", "id").map_err(db_error)?,
                name: row.try_get("", "name").map_err(db_error)?,
                sku: row.try_get("", "sku").map_err(db_error)?,
                barcode: row.try_get("", "barcode").map_err(db_error)?,
                category_id: row.try_get("", "category_id").map_err(db_error)?,
                price: row.try_get("", "price").map_err(db_error)?,
                cost: row.try_get("", "cost").map_err(db_error)?,
                stock: row.try_get("", "stock").map_err(db_error)?,
                reorder_level: row.try_get("", "reorder_level").map_err(db_error)?,
                is_active: row.try_get("", "is_active").map_err(db_error)?,
            })
        })
        .collect()
}

#[tauri::command]
async fn create_product(
    db: tauri::State<'_, Db>,
    input: ProductInput,
) -> Result<ProductDto, String> {
    if input.name.trim().is_empty() || input.price < 0 || input.cost < 0 || input.stock < 0 {
        return Err("Product details are invalid".into());
    }
    let product_id = id();
    let guard = db.lock().await;
    guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO products (id,name,sku,barcode,category_id,price,cost,stock,reorder_level,is_active) VALUES ({},{},{},{},{},{},{},{},{},1)", sql(&product_id), sql(input.name.trim()), input.sku.as_deref().map(sql).unwrap_or("NULL".into()), input.barcode.as_deref().map(sql).unwrap_or("NULL".into()), input.category_id.as_deref().map(sql).unwrap_or("NULL".into()), input.price, input.cost, input.stock, input.reorder_level))).await.map_err(db_error)?;
    if input.stock > 0 {
        guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO stock_movements (id,product_id,change,reason,note) VALUES ({},{}, {},'initial',NULL)", sql(&id()), sql(&product_id), input.stock))).await.map_err(db_error)?;
    }
    query_product(&guard, &product_id).await
}

#[tauri::command]
async fn update_product(
    db: tauri::State<'_, Db>,
    product_id: String,
    input: ProductInput,
) -> Result<ProductDto, String> {
    let guard = db.lock().await;
    guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("UPDATE products SET name={},sku={},barcode={},category_id={},price={},cost={},reorder_level={},updated_at=CURRENT_TIMESTAMP WHERE id={}", sql(input.name.trim()), input.sku.as_deref().map(sql).unwrap_or("NULL".into()), input.barcode.as_deref().map(sql).unwrap_or("NULL".into()), input.category_id.as_deref().map(sql).unwrap_or("NULL".into()), input.price, input.cost, input.reorder_level, sql(&product_id)))).await.map_err(db_error)?;
    query_product(&guard, &product_id).await
}

#[tauri::command]
async fn set_product_active(
    db: tauri::State<'_, Db>,
    product_id: String,
    is_active: bool,
) -> Result<(), String> {
    let guard = db.lock().await;
    guard
        .execute_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "UPDATE products SET is_active={} WHERE id={}",
                if is_active { 1 } else { 0 },
                sql(&product_id)
            ),
        ))
        .await
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
async fn list_categories(db: tauri::State<'_, Db>) -> Result<Vec<CategoryDto>, String> {
    let guard = db.lock().await;
    let rows = guard
        .query_all_raw(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT id,name FROM categories ORDER BY name",
        ))
        .await
        .map_err(db_error)?;
    rows.into_iter()
        .map(|r| {
            Ok(CategoryDto {
                id: r.try_get("", "id").map_err(db_error)?,
                name: r.try_get("", "name").map_err(db_error)?,
            })
        })
        .collect()
}

#[tauri::command]
async fn create_category(db: tauri::State<'_, Db>, name: String) -> Result<CategoryDto, String> {
    let category_id = id();
    let guard = db.lock().await;
    guard
        .execute_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "INSERT INTO categories (id,name) VALUES ({},{})",
                sql(&category_id),
                sql(name.trim())
            ),
        ))
        .await
        .map_err(db_error)?;
    Ok(CategoryDto {
        id: category_id,
        name,
    })
}

#[tauri::command]
async fn adjust_stock(
    db: tauri::State<'_, Db>,
    product_id: String,
    change: i64,
    reason: String,
    note: Option<String>,
) -> Result<(), String> {
    let guard = db.lock().await;
    let product = query_product(&guard, &product_id).await?;
    if product.stock + change < 0 {
        return Err("Stock cannot go below zero".into());
    }
    guard
        .execute_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "UPDATE products SET stock=stock+{},updated_at=CURRENT_TIMESTAMP WHERE id={}",
                change,
                sql(&product_id)
            ),
        ))
        .await
        .map_err(db_error)?;
    guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO stock_movements (id,product_id,change,reason,note) VALUES ({},{},{},{},{})", sql(&id()), sql(&product_id), change, sql(&reason), note.as_deref().map(sql).unwrap_or("NULL".into())))).await.map_err(db_error)?;
    Ok(())
}

#[tauri::command]
async fn list_stock_movements(
    db: tauri::State<'_, Db>,
    product_id: Option<String>,
    limit: i64,
) -> Result<Vec<MovementDto>, String> {
    let guard = db.lock().await;
    let where_sql = product_id
        .as_deref()
        .map(|p| format!(" WHERE m.product_id={}", sql(p)))
        .unwrap_or_default();
    let rows = guard.query_all_raw(Statement::from_string(DbBackend::Sqlite, format!("SELECT m.id,m.product_id,p.name product_name,m.change,m.reason,m.note,m.created_at FROM stock_movements m JOIN products p ON p.id=m.product_id{} ORDER BY m.created_at DESC LIMIT {}", where_sql, limit.clamp(1, 500)))).await.map_err(db_error)?;
    rows.into_iter()
        .map(|r| {
            Ok(MovementDto {
                id: r.try_get("", "id").map_err(db_error)?,
                product_id: r.try_get("", "product_id").map_err(db_error)?,
                product_name: r.try_get("", "product_name").map_err(db_error)?,
                change: r.try_get("", "change").map_err(db_error)?,
                reason: r.try_get("", "reason").map_err(db_error)?,
                note: r.try_get("", "note").map_err(db_error)?,
                created_at: r.try_get("", "created_at").map_err(db_error)?,
            })
        })
        .collect()
}

#[tauri::command]
async fn checkout(
    db: tauri::State<'_, Db>,
    items: Vec<CartItem>,
    payment_method: String,
) -> Result<CheckoutResult, String> {
    if items.is_empty() {
        return Err("Cart is empty".into());
    }
    let guard = db.lock().await;
    let sale_id = id();
    let mut subtotal = 0;
    let tax_rate = guard
        .query_one_raw(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT value FROM settings WHERE key='tax_rate'",
        ))
        .await
        .map_err(db_error)?
        .and_then(|row| row.try_get::<String>("", "value").ok())
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0)
        .clamp(0.0, 100.0);
    let allow_negative_stock = guard
        .query_one_raw(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT value FROM settings WHERE key='allow_negative_stock'",
        ))
        .await
        .map_err(db_error)?
        .and_then(|row| row.try_get::<String>("", "value").ok())
        .map(|value| value == "true")
        .unwrap_or(false);
    for item in &items {
        let p = query_product(&guard, &item.product_id).await?;
        if item.quantity <= 0 || (!allow_negative_stock && p.stock < item.quantity) {
            return Err(format!("Not enough stock for {}", p.name));
        }
        subtotal += p.price * item.quantity;
    }
    let tax = ((subtotal as f64) * tax_rate / 100.0).round() as i64;
    let total = subtotal + tax;
    guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO sales (id,subtotal,tax,total,payment_method,status) VALUES ({},{},{},{},{},'completed')", sql(&sale_id), subtotal, tax, total, sql(&payment_method)))).await.map_err(db_error)?;
    for item in items {
        let p = query_product(&guard, &item.product_id).await?;
        guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO sale_items (id,sale_id,product_id,quantity,unit_price,unit_cost) VALUES ({},{},{},{},{},{})", sql(&id()), sql(&sale_id), sql(&item.product_id), item.quantity, p.price, p.cost))).await.map_err(db_error)?;
        guard
            .execute_raw(Statement::from_string(
                DbBackend::Sqlite,
                format!(
                    "UPDATE products SET stock=stock-{},updated_at=CURRENT_TIMESTAMP WHERE id={}",
                    item.quantity,
                    sql(&item.product_id)
                ),
            ))
            .await
            .map_err(db_error)?;
        guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO stock_movements (id,product_id,change,reason,reference_id) VALUES ({},{}, {},'sale',{})", sql(&id()), sql(&item.product_id), -item.quantity, sql(&sale_id)))).await.map_err(db_error)?;
    }
    let created_at = guard
        .query_one_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!("SELECT created_at FROM sales WHERE id={}", sql(&sale_id)),
        ))
        .await
        .map_err(db_error)?
        .ok_or("Sale timestamp was not created")?
        .try_get("", "created_at")
        .map_err(db_error)?;
    Ok(CheckoutResult {
        sale_id,
        subtotal,
        tax,
        total,
        created_at,
    })
}

async fn sales_query(db: &DatabaseConnection, where_sql: &str) -> Result<Vec<SaleDto>, String> {
    let rows = db.query_all_raw(Statement::from_string(DbBackend::Sqlite, format!("SELECT id,subtotal,discount,tax,total,payment_method,status,created_at FROM sales {} ORDER BY created_at DESC", where_sql))).await.map_err(db_error)?;
    rows.into_iter()
        .map(|r| {
            Ok(SaleDto {
                id: r.try_get("", "id").map_err(db_error)?,
                subtotal: r.try_get("", "subtotal").map_err(db_error)?,
                discount: r.try_get("", "discount").map_err(db_error)?,
                tax: r.try_get("", "tax").map_err(db_error)?,
                total: r.try_get("", "total").map_err(db_error)?,
                payment_method: r.try_get("", "payment_method").map_err(db_error)?,
                status: r.try_get("", "status").map_err(db_error)?,
                created_at: r.try_get("", "created_at").map_err(db_error)?,
            })
        })
        .collect()
}
#[tauri::command]
async fn list_sales(
    db: tauri::State<'_, Db>,
    from: String,
    to: String,
) -> Result<Vec<SaleDto>, String> {
    let guard = db.lock().await;
    sales_query(
        &guard,
        &format!(
            "WHERE date(created_at) BETWEEN date({}) AND date({})",
            sql(&from),
            sql(&to)
        ),
    )
    .await
}
#[tauri::command]
async fn get_sale_items(
    db: tauri::State<'_, Db>,
    sale_id: String,
) -> Result<Vec<SaleItemDto>, String> {
    let guard = db.lock().await;
    let rows = guard.query_all_raw(Statement::from_string(DbBackend::Sqlite, format!("SELECT i.id,p.name product_name,i.quantity,i.unit_price FROM sale_items i JOIN products p ON p.id=i.product_id WHERE i.sale_id={}", sql(&sale_id)))).await.map_err(db_error)?;
    rows.into_iter()
        .map(|r| {
            Ok(SaleItemDto {
                id: r.try_get("", "id").map_err(db_error)?,
                product_name: r.try_get("", "product_name").map_err(db_error)?,
                quantity: r.try_get("", "quantity").map_err(db_error)?,
                unit_price: r.try_get("", "unit_price").map_err(db_error)?,
            })
        })
        .collect()
}
#[tauri::command]
async fn void_sale(db: tauri::State<'_, Db>, sale_id: String) -> Result<(), String> {
    let guard = db.lock().await;
    let sale = guard
        .query_one_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!("SELECT status FROM sales WHERE id={}", sql(&sale_id)),
        ))
        .await
        .map_err(db_error)?
        .ok_or("Sale not found")?;
    let status: String = sale.try_get("", "status").map_err(db_error)?;
    if status != "completed" {
        return Err("Sale is already voided".into());
    }
    let items = guard
        .query_all_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "SELECT product_id,quantity FROM sale_items WHERE sale_id={}",
                sql(&sale_id)
            ),
        ))
        .await
        .map_err(db_error)?;
    for item in items {
        let product_id: String = item.try_get("", "product_id").map_err(db_error)?;
        let quantity: i64 = item.try_get("", "quantity").map_err(db_error)?;
        guard
            .execute_raw(Statement::from_string(
                DbBackend::Sqlite,
                format!(
                    "UPDATE products SET stock=stock+{},updated_at=CURRENT_TIMESTAMP WHERE id={}",
                    quantity,
                    sql(&product_id)
                ),
            ))
            .await
            .map_err(db_error)?;
        guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO stock_movements (id,product_id,change,reason,reference_id) VALUES ({},{}, {},'void',{})", sql(&id()), sql(&product_id), quantity, sql(&sale_id)))).await.map_err(db_error)?;
    }
    guard
        .execute_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "UPDATE sales SET status='voided' WHERE id={}",
                sql(&sale_id)
            ),
        ))
        .await
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
async fn get_settings(db: tauri::State<'_, Db>) -> Result<HashMap<String, String>, String> {
    let guard = db.lock().await;
    let rows = guard
        .query_all_raw(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT key,value FROM settings",
        ))
        .await
        .map_err(db_error)?;
    rows.into_iter()
        .map(|r| {
            Ok((
                r.try_get("", "key").map_err(db_error)?,
                r.try_get("", "value").map_err(db_error)?,
            ))
        })
        .collect()
}
#[tauri::command]
async fn save_settings(
    db: tauri::State<'_, Db>,
    settings: HashMap<String, String>,
) -> Result<(), String> {
    let guard = db.lock().await;
    for (key, value) in settings {
        guard.execute_raw(Statement::from_string(DbBackend::Sqlite, format!("INSERT INTO settings(key,value) VALUES ({},{}) ON CONFLICT(key) DO UPDATE SET value=excluded.value", sql(&key), sql(&value)))).await.map_err(db_error)?;
    }
    Ok(())
}

#[tauri::command]
async fn dashboard_stats(db: tauri::State<'_, Db>) -> Result<DashboardDto, String> {
    let guard = db.lock().await;
    let row = guard.query_one_raw(Statement::from_string(DbBackend::Sqlite, "SELECT COALESCE(SUM(total),0) revenue,COUNT(*) transactions FROM sales WHERE status='completed' AND date(created_at)=date('now','localtime')")).await.map_err(db_error)?.ok_or("Unable to load dashboard")?;
    let low: i64 = guard
        .query_one_raw(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT COUNT(*) count FROM products WHERE is_active=1 AND stock<=reorder_level",
        ))
        .await
        .map_err(db_error)?
        .unwrap()
        .try_get("", "count")
        .map_err(db_error)?;
    let recent_sales = sales_query(&guard, "WHERE status='completed'")
        .await?
        .into_iter()
        .take(5)
        .collect();
    Ok(DashboardDto {
        today_revenue: row.try_get("", "revenue").map_err(db_error)?,
        today_transactions: row.try_get("", "transactions").map_err(db_error)?,
        today_profit: 0,
        low_stock_count: low,
        top_products: vec![],
        recent_sales,
    })
}
#[tauri::command]
async fn report_sales_by_day(
    db: tauri::State<'_, Db>,
    from: String,
    to: String,
) -> Result<Vec<DayRow>, String> {
    let guard = db.lock().await;
    let rows = guard
        .query_all_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "SELECT date(created_at) day,COUNT(*) transactions,COALESCE(SUM(total),0) revenue FROM sales WHERE status='completed' AND date(created_at) BETWEEN date({}) AND date({}) GROUP BY date(created_at) ORDER BY day",
                sql(&from), sql(&to)
            ),
        ))
        .await
        .map_err(db_error)?;
    rows.into_iter()
        .map(|row| {
            Ok(DayRow {
                day: row.try_get("", "day").map_err(db_error)?,
                transactions: row.try_get("", "transactions").map_err(db_error)?,
                revenue: row.try_get("", "revenue").map_err(db_error)?,
            })
        })
        .collect()
}

#[tauri::command]
async fn report_profit_by_product(
    db: tauri::State<'_, Db>,
    from: String,
    to: String,
) -> Result<Vec<ProfitRow>, String> {
    let guard = db.lock().await;
    let rows = guard
        .query_all_raw(Statement::from_string(
            DbBackend::Sqlite,
            format!(
                "SELECT p.name,SUM(i.quantity) units,SUM(i.quantity*i.unit_price) revenue,SUM(i.quantity*(i.unit_price-i.unit_cost)) profit FROM sale_items i JOIN sales s ON s.id=i.sale_id JOIN products p ON p.id=i.product_id WHERE s.status='completed' AND date(s.created_at) BETWEEN date({}) AND date({}) GROUP BY p.id ORDER BY profit DESC",
                sql(&from), sql(&to)
            ),
        ))
        .await
        .map_err(db_error)?;
    rows.into_iter()
        .map(|row| {
            Ok(ProfitRow {
                name: row.try_get("", "name").map_err(db_error)?,
                units: row.try_get("", "units").map_err(db_error)?,
                revenue: row.try_get("", "revenue").map_err(db_error)?,
                profit: row.try_get("", "profit").map_err(db_error)?,
            })
        })
        .collect()
}
#[tauri::command]
async fn report_inventory_valuation(db: tauri::State<'_, Db>) -> Result<Vec<ValuationRow>, String> {
    let guard = db.lock().await;
    let rows = guard.query_all_raw(Statement::from_string(DbBackend::Sqlite, "SELECT name,stock,stock*cost cost_value,stock*price retail_value FROM products WHERE is_active=1 ORDER BY name")).await.map_err(db_error)?;
    rows.into_iter()
        .map(|r| {
            Ok(ValuationRow {
                name: r.try_get("", "name").map_err(db_error)?,
                stock: r.try_get("", "stock").map_err(db_error)?,
                cost_value: r.try_get("", "cost_value").map_err(db_error)?,
                retail_value: r.try_get("", "retail_value").map_err(db_error)?,
            })
        })
        .collect()
}
#[tauri::command]
async fn backup_database(
    app: tauri::AppHandle,
    _db: tauri::State<'_, Db>,
    path: String,
) -> Result<(), String> {
    let source = database_path(&app)?;
    fs::copy(source, PathBuf::from(path)).map_err(db_error)?;
    Ok(())
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = if cfg!(debug_assertions) {
        std::env::current_dir()
            .map_err(db_error)?
            .join("src-tauri/dev.db")
    } else {
        app.path()
            .app_data_dir()
            .map_err(db_error)?
            .join("near-visor.db")
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(db_error)?;
    }
    Ok(path)
}

async fn ensure_schema(db: &DatabaseConnection) -> Result<(), String> {
    db.execute_unprepared("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, sku TEXT UNIQUE, barcode TEXT UNIQUE, category_id TEXT REFERENCES categories(id) ON DELETE SET NULL, price BIGINT NOT NULL CHECK (price >= 0), cost BIGINT NOT NULL DEFAULT 0 CHECK (cost >= 0), stock INTEGER NOT NULL DEFAULT 0, reorder_level INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY NOT NULL, user_id TEXT REFERENCES users(id), subtotal BIGINT NOT NULL, discount BIGINT NOT NULL DEFAULT 0, tax BIGINT NOT NULL DEFAULT 0, total BIGINT NOT NULL, payment_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'completed', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS sale_items (id TEXT PRIMARY KEY NOT NULL, sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price BIGINT NOT NULL, unit_cost BIGINT NOT NULL);
        CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT REFERENCES users(id), change INTEGER NOT NULL, reason TEXT NOT NULL, reference_id TEXT, note TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);").await.map_err(db_error)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = database_path(app.handle())?;
            let db = tauri::async_runtime::block_on(Database::connect(format!(
                "sqlite://{}?mode=rwc",
                path.to_string_lossy()
            )))
            .map_err(db_error)?;
            tauri::async_runtime::block_on(ensure_schema(&db))?;
            app.manage(Arc::new(Mutex::new(db)));
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_products,
            create_product,
            update_product,
            set_product_active,
            list_categories,
            create_category,
            adjust_stock,
            list_stock_movements,
            checkout,
            list_sales,
            get_sale_items,
            void_sale,
            dashboard_stats,
            report_sales_by_day,
            report_profit_by_product,
            report_inventory_valuation,
            get_settings,
            save_settings,
            backup_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
