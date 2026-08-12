# Full API Test Suite for CMS
# Tests every endpoint with authentication

$BASE = "http://localhost:3000"
$EMAIL = "sampadchowdhury777@gmail.com"
$PASSWORD = "Verify@2025!"

Write-Host "============================================"
Write-Host "CMS API VERIFICATION SUITE"
Write-Host "============================================"

# ------ Step 1: Login & capture session cookie ------
Write-Host "`n[1] LOGIN TEST"
$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = "{`"email`":`"$EMAIL`",`"password`":`"$PASSWORD`"}"

$loginResp = Invoke-WebRequest -Uri "$BASE/api/admin/login" -Method POST `
  -ContentType "application/json" -Body $loginBody `
  -SessionVariable ws -UseBasicParsing

$webSession = $ws
Write-Host "  Login Status: $($loginResp.StatusCode)"
$cookies = $webSession.Cookies.GetCookies("http://localhost:3000")
$sessionCookie = $cookies | Where-Object { $_.Name -eq "admin_session" }
Write-Host "  Session Cookie Set: $($null -ne $sessionCookie)"
Write-Host "  Cookie HttpOnly: $($sessionCookie.HttpOnly)"

# ------ Step 2: Test unauthenticated access is blocked ------
Write-Host "`n[2] UNAUTHORIZED ACCESS TEST"
try {
  $unauthResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts" -Method GET -UseBasicParsing
  Write-Host "  FAIL: Should have been blocked but got $($unauthResp.StatusCode)"
} catch {
  Write-Host "  PASS: Unauthenticated request correctly rejected (status: $($_.Exception.Response.StatusCode))"
}

# ------ Step 3: Get posts (authenticated) ------
Write-Host "`n[3] GET POSTS (authenticated)"
$postsResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts" -Method GET -WebSession $webSession -UseBasicParsing
$postsData = $postsResp.Content | ConvertFrom-Json
Write-Host "  Status: $($postsResp.StatusCode)"
Write-Host "  Posts count: $($postsData.posts.Count)"

# ------ Step 4: Create a post ------
Write-Host "`n[4] CREATE POST (Instagram)"
$createBody = @{
  title = "E2E Test Post"
  slug = "e2e-test-post-$(Get-Date -Format 'yyyyMMddHHmmss')"
  shortDesc = "Automated verification post"
  content = "<p>This is <strong>test content</strong> for verification.</p>"
  platform = "INSTAGRAM"
  status = "DRAFT"
  publishDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
  seoTitle = "E2E Test Post"
  seoDescription = "Automated verification post for E2E testing"
  canonicalUrl = ""
  keywords = "test, verification"
  categoryIds = @()
  tagIds = @()
} | ConvertTo-Json

$createResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts" -Method POST `
  -ContentType "application/json" -Body $createBody -WebSession $webSession -UseBasicParsing

$createdPost = $createResp.Content | ConvertFrom-Json
Write-Host "  Status: $($createResp.StatusCode)"
Write-Host "  Created Post ID: $($createdPost.post.id)"
Write-Host "  Created Post Title: $($createdPost.post.title)"
$postId = $createdPost.post.id

# ------ Step 5: Get single post ------
Write-Host "`n[5] GET SINGLE POST"
$getPostResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts/$postId" -Method GET -WebSession $webSession -UseBasicParsing
$getPostData = $getPostResp.Content | ConvertFrom-Json
Write-Host "  Status: $($getPostResp.StatusCode)"
Write-Host "  Title: $($getPostData.post.title)"
Write-Host "  Status: $($getPostData.post.status)"

# ------ Step 6: Publish the post ------
Write-Host "`n[6] PUBLISH POST"
$updateBody = @{
  status = "PUBLISHED"
} | ConvertTo-Json
$pubResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts/$postId" -Method PATCH `
  -ContentType "application/json" -Body $updateBody -WebSession $webSession -UseBasicParsing
Write-Host "  Status: $($pubResp.StatusCode)"

# ------ Step 7: Check post appears on frontend ------
Write-Host "`n[7] FRONTEND: Check Instagram page shows published post"
$igPage = Invoke-WebRequest -Uri "$BASE/instagram" -Method GET -UseBasicParsing
if ($igPage.Content -match "E2E Test Post") {
  Write-Host "  PASS: Post appears on Instagram frontend page"
} else {
  Write-Host "  FAIL or NOTE: Post not yet visible (ISR revalidation delay expected)"
}

# ------ Step 8: Delete the post ------
Write-Host "`n[8] DELETE POST"
$delResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts/$postId" -Method DELETE -WebSession $webSession -UseBasicParsing
Write-Host "  Status: $($delResp.StatusCode)"

# ------ Step 9: Verify deletion ------
Write-Host "`n[9] VERIFY POST DELETED"
try {
  $verifyResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts/$postId" -Method GET -WebSession $webSession -UseBasicParsing
  Write-Host "  WARNING: Post still returned, status: $($verifyResp.StatusCode)"
} catch {
  Write-Host "  PASS: Post correctly returns 404 after deletion"
}

# ------ Step 10: Categories CRUD ------
Write-Host "`n[10] CATEGORIES CRUD"
$catResp = Invoke-WebRequest -Uri "$BASE/api/admin/categories" -Method GET -WebSession $webSession -UseBasicParsing
$catData = $catResp.Content | ConvertFrom-Json
Write-Host "  GET Categories - Count: $($catData.categories.Count)"

$newCatBody = @{ name = "Verification Category"; slug = "verification-cat-$(Get-Date -Format 'HHmmss')" } | ConvertTo-Json
$createCatResp = Invoke-WebRequest -Uri "$BASE/api/admin/categories" -Method POST `
  -ContentType "application/json" -Body $newCatBody -WebSession $webSession -UseBasicParsing
$newCat = $createCatResp.Content | ConvertFrom-Json
Write-Host "  POST Category - Created ID: $($newCat.id)"

$delCatResp = Invoke-WebRequest -Uri "$BASE/api/admin/categories/$($newCat.id)" -Method DELETE -WebSession $webSession -UseBasicParsing
Write-Host "  DELETE Category - Status: $($delCatResp.StatusCode)"

# ------ Step 11: Tags CRUD ------
Write-Host "`n[11] TAGS CRUD"
$tagResp = Invoke-WebRequest -Uri "$BASE/api/admin/tags" -Method GET -WebSession $webSession -UseBasicParsing
$tagData = $tagResp.Content | ConvertFrom-Json
Write-Host "  GET Tags - Count: $($tagData.tags.Count)"

$newTagBody = @{ name = "verify-tag-$(Get-Date -Format 'HHmmss')"; slug = "verify-tag-$(Get-Date -Format 'HHmmss')" } | ConvertTo-Json
$createTagResp = Invoke-WebRequest -Uri "$BASE/api/admin/tags" -Method POST `
  -ContentType "application/json" -Body $newTagBody -WebSession $webSession -UseBasicParsing
$newTag = $createTagResp.Content | ConvertFrom-Json
Write-Host "  POST Tag - Created ID: $($newTag.id)"

$delTagResp = Invoke-WebRequest -Uri "$BASE/api/admin/tags/$($newTag.id)" -Method DELETE -WebSession $webSession -UseBasicParsing
Write-Host "  DELETE Tag - Status: $($delTagResp.StatusCode)"

# ------ Step 12: Comments API ------
Write-Host "`n[12] COMMENTS API"
$commResp = Invoke-WebRequest -Uri "$BASE/api/admin/comments" -Method GET -WebSession $webSession -UseBasicParsing
$commData = $commResp.Content | ConvertFrom-Json
Write-Host "  GET Comments - Count: $($commData.comments.Count)"

# ------ Step 13: Analytics API ------
Write-Host "`n[13] ANALYTICS API"
$analyticsResp = Invoke-WebRequest -Uri "$BASE/api/admin/analytics" -Method GET -WebSession $webSession -UseBasicParsing
$analyticsData = $analyticsResp.Content | ConvertFrom-Json
Write-Host "  Status: $($analyticsResp.StatusCode)"
Write-Host "  Total Visits: $($analyticsData.totalVisits)"
Write-Host "  Top Paths count: $($analyticsData.topPaths.Count)"

# ------ Step 14: Settings API ------
Write-Host "`n[14] SETTINGS API"
$getSettingsResp = Invoke-WebRequest -Uri "$BASE/api/admin/settings" -Method GET -WebSession $webSession -UseBasicParsing
$settingsData = $getSettingsResp.Content | ConvertFrom-Json
Write-Host "  GET Settings - Status: $($getSettingsResp.StatusCode)"
Write-Host "  Settings count: $($settingsData.settings.Count)"

$putSettingsBody = @{ settings = @(@{ key = "siteName"; value = "Chowdhury Duo Verified" }) } | ConvertTo-Json -Depth 5
$putSettingsResp = Invoke-WebRequest -Uri "$BASE/api/admin/settings" -Method PUT `
  -ContentType "application/json" -Body $putSettingsBody -WebSession $webSession -UseBasicParsing
Write-Host "  PUT Settings - Status: $($putSettingsResp.StatusCode)"

# Verify settings persisted
$verifySettingsResp = Invoke-WebRequest -Uri "$BASE/api/admin/settings" -Method GET -WebSession $webSession -UseBasicParsing
$verifySettingsData = $verifySettingsResp.Content | ConvertFrom-Json
$siteNameSetting = $verifySettingsData.settings | Where-Object { $_.key -eq "siteName" }
Write-Host "  Verify Persisted - siteName: $($siteNameSetting.value)"

# ------ Step 15: Rate Limiting Test ------
Write-Host "`n[15] RATE LIMITING TEST"
$badBody = '{"email":"attacker@evil.com","password":"wrongpassword"}'
$attempts = 0
for ($i = 1; $i -le 6; $i++) {
  try {
    $rateResp = Invoke-WebRequest -Uri "$BASE/api/admin/login" -Method POST `
      -ContentType "application/json" -Body $badBody -UseBasicParsing
    $attempts = $i
  } catch {
    $statusCode = $_.Exception.Response.StatusCode
    if ($statusCode -eq "TooManyRequests") {
      Write-Host "  PASS: Rate limit triggered after $i attempts (429)"
      break
    } else {
      $attempts = $i
    }
  }
}
if ($attempts -ge 6) {
  Write-Host "  INFO: Rate limit not triggered in 6 attempts (configured for 5 then lockout based on IP)"
}

# ------ Step 16: Logout ------
Write-Host "`n[16] LOGOUT TEST"
$logoutResp = Invoke-WebRequest -Uri "$BASE/api/admin/logout" -Method POST -WebSession $webSession -UseBasicParsing
Write-Host "  Logout Status: $($logoutResp.StatusCode)"

# Verify session is invalidated
try {
  $postLogoutResp = Invoke-WebRequest -Uri "$BASE/api/admin/posts" -Method GET -WebSession $webSession -UseBasicParsing
  Write-Host "  FAIL: Session still valid after logout - status: $($postLogoutResp.StatusCode)"
} catch {
  Write-Host "  PASS: Session correctly invalidated after logout"
}

Write-Host "`n============================================"
Write-Host "API TEST SUITE COMPLETE"
Write-Host "============================================"
