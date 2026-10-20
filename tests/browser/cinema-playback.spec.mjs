import {test,expect} from '@playwright/test';
test('Open movie loads real video metadata and plays',async({page})=>{
 await page.goto('/cinema/');
 await page.getByRole('button',{name:'Sintel movie'}).click();
 await page.getByRole('button',{name:'Blender Foundation · MP4'}).click();
 await expect(page.locator('video')).toBeVisible();
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.duration>0&&v.currentTime>0&&!v.paused;},null,{timeout:45000});
 await page.screenshot({path:'../../outputs/Nebula-Cinema.png'});
 await page.locator('#details .close').click();
 await expect(page.locator('video')).not.toHaveAttribute('src',/.+/);
});
