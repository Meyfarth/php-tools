<?php

class EmptyClass
{
    public function testExtractVariable(bool $isTrue, string $whatever)
    {
        $check = $isTrue && $whatever === 'WeshGros';
        if ($check) {
            return false;
        }

        return true;
    }
}